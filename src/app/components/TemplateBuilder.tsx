'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Chip, Select, SelectItem, Input, Textarea, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Divider, Avatar, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
import { printTemplates, type PrintType } from '../lib/print/templates';
import { renderPrint } from '../lib/print/engine';
import { trackEvent } from '../lib/analytics/trackEvent';

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'receipt' | 'invoice' | 'payment-order' | 'purchase-order' | 'proforma' | 'quotation' | 'contract' | 'report';
  category: 'financial' | 'operational' | 'legal' | 'marketing';
  description: string;
  preview: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  variables: TemplateVariable[];
  styling: TemplateStyling;
  compliance: ComplianceSettings;
  html: string;
  css: string;
}

interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validation?: string;
}

interface TemplateStyling {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  fontSize: string;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  headerStyle: 'minimal' | 'professional' | 'luxury' | 'modern';
  footerStyle: 'simple' | 'detailed' | 'none';
}

interface ComplianceSettings {
  ghanaVAT: boolean;
  ghanaNHIL: boolean;
  ghanaTourismLevy: boolean;
  ssnit: boolean;
  incomeTax: boolean;
  customFields: Record<string, boolean>;
}

export default function TemplateBuilder() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [builderBlocks, setBuilderBlocks] = useState<Array<any>>([]);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const compiledDoc = useMemo(() => compileBlocksToHtmlCss(builderBlocks), [builderBlocks]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<DocumentTemplate>>({});
  const [editVars, setEditVars] = useState<any[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const settings = useSettingsStore();

  // Initialize templates in store if they don't exist
  useEffect(() => {
    if (settings.documentTemplates.templates.length === 0) {
      initializeDefaultTemplates();
    }
  }, []);

  const initializeDefaultTemplates = () => {
    const defaultTemplates: DocumentTemplate[] = [
      {
        id: 'ghana-standard-receipt',
        name: 'Ghana Standard Receipt',
        type: 'receipt',
        category: 'financial',
        description: 'Professional receipt template with Ghana VAT compliance',
        preview: 'ghana-standard-receipt',
        isActive: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variables: [
          { key: 'hotelName', label: 'Hotel Name', type: 'text', required: true, defaultValue: 'Ghana Hotel' },
          { key: 'guestName', label: 'Guest Name', type: 'text', required: true },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'vat', label: 'VAT Amount', type: 'number', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] }
        ],
        styling: {
          primaryColor: '#1e40af',
          secondaryColor: '#64748b',
          fontFamily: 'Inter',
          fontSize: '14px',
          logoPosition: 'top-left',
          headerStyle: 'professional',
          footerStyle: 'detailed'
        },
        compliance: {
          ghanaVAT: true,
          ghanaNHIL: true,
          ghanaTourismLevy: true,
          ssnit: false,
          incomeTax: false,
          customFields: {}
        },
        html: `<div class="receipt">
          <div class="header">
            <h1>{{hotelName}}</h1>
            <p>Receipt</p>
          </div>
          <div class="content">
            <p><strong>Guest:</strong> {{guestName}}</p>
            <p><strong>Amount:</strong> ₵{{amount}}</p>
            <p><strong>VAT:</strong> ₵{{vat}}</p>
            <p><strong>Date:</strong> {{date}}</p>
          </div>
        </div>`,
        css: `.receipt { font-family: Inter; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .content { margin: 20px 0; }`
      },
      {
        id: 'luxury-hotel-invoice',
        name: 'Luxury Hotel Invoice',
        type: 'invoice',
        category: 'financial',
        description: 'Premium invoice template for luxury hotels',
        preview: 'luxury-hotel-invoice',
        isActive: true,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variables: [
          { key: 'hotelName', label: 'Hotel Name', type: 'text', required: true, defaultValue: 'Luxury Hotel' },
          { key: 'guestName', label: 'Guest Name', type: 'text', required: true },
          { key: 'roomNumber', label: 'Room Number', type: 'text', required: true },
          { key: 'checkIn', label: 'Check-in Date', type: 'date', required: true },
          { key: 'checkOut', label: 'Check-out Date', type: 'date', required: true },
          { key: 'totalAmount', label: 'Total Amount', type: 'number', required: true }
        ],
        styling: {
          primaryColor: '#dc2626',
          secondaryColor: '#fbbf24',
          fontFamily: 'Playfair Display',
          fontSize: '16px',
          logoPosition: 'top-center',
          headerStyle: 'luxury',
          footerStyle: 'detailed'
        },
        compliance: {
          ghanaVAT: true,
          ghanaNHIL: true,
          ghanaTourismLevy: true,
          ssnit: false,
          incomeTax: false,
          customFields: {}
        },
        html: `<div class="invoice luxury">
          <div class="header">
            <h1>{{hotelName}}</h1>
            <h2>Invoice</h2>
          </div>
          <div class="content">
            <p><strong>Guest:</strong> {{guestName}}</p>
            <p><strong>Room:</strong> {{roomNumber}}</p>
            <p><strong>Check-in:</strong> {{checkIn}}</p>
            <p><strong>Check-out:</strong> {{checkOut}}</p>
            <p><strong>Total:</strong> ₵{{totalAmount}}</p>
          </div>
        </div>`,
        css: `.invoice.luxury { font-family: 'Playfair Display'; padding: 30px; background: linear-gradient(135deg, #dc2626, #fbbf24); color: white; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin: 30px 0; }`
      }
    ];

    // Add each template to the store
    defaultTemplates.forEach(template => {
      settings.addTemplate(template);
    });
  };

  // Get templates from store
  const documentTemplates = settings.documentTemplates.templates;

  const documentTypes = [
    { key: 'all', label: 'All Documents' },
    { key: 'receipt', label: 'Receipts' },
    { key: 'invoice', label: 'Invoices' },
    { key: 'payment-order', label: 'Payment Orders' },
    { key: 'purchase-order', label: 'Purchase Orders' },
    { key: 'proforma', label: 'Proforma Invoices' },
    { key: 'quotation', label: 'Quotations' },
    { key: 'contract', label: 'Contracts' },
    { key: 'report', label: 'Reports' }
  ];

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'financial', label: 'Financial' },
    { key: 'operational', label: 'Operational' },
    { key: 'legal', label: 'Legal' },
    { key: 'marketing', label: 'Marketing' }
  ];
  const purposes = [
    { key: 'all', label: 'All Purposes' },
    { key: 'checkout', label: 'Checkout' },
    { key: 'folio', label: 'Folio / Billing' },
    { key: 'accommodation', label: 'Accommodation' },
    { key: 'conference', label: 'Conference & Events' },
    { key: 'restaurant', label: 'Restaurant / F&B' },
    { key: 'quotation', label: 'Quotation / Proforma' }
  ];

  const filteredTemplates = documentTemplates.filter(template => {
    const typeMatch = selectedDocumentType === 'all' || template.type === selectedDocumentType;
    const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory;
    const purposeMatch = selectedPurpose === 'all' || (template as any).purpose === selectedPurpose;
    return typeMatch && categoryMatch && purposeMatch;
  });

  const handlePreviewTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewModalOpen(true);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setIsEditModalOpen(true);
  };

  const handleCreateTemplate = () => {
    setIsCreateModalOpen(true);
    setSelectedTemplate(null);
    setEditData({
      name: 'New Template',
      type: 'receipt',
      category: 'financial',
      purpose: 'folio',
      description: '',
      preview: 'new-template',
      isActive: true,
      isDefault: false,
      variables: [],
      styling: {
        primaryColor: '#1e40af',
        secondaryColor: '#64748b',
        fontFamily: 'Inter',
        fontSize: '14px',
        logoPosition: 'top-left',
        headerStyle: 'professional',
        footerStyle: 'detailed'
      },
      compliance: {
        ghanaVAT: true,
        ghanaNHIL: true,
        ghanaTourismLevy: true,
        ssnit: false,
        incomeTax: false,
        customFields: {}
      },
      html: '<div>New Template</div>',
      css: '.new-template { }'
    } as any);
    setEditVars([]);
  };

  const handleOpenGallery = () => {
    setIsGalleryOpen(true);
  };

  const handleActivateTemplate = (templateId: string) => {
    setIsLoading(true);
    try {
      settings.activateTemplate(templateId);
      trackEvent('Template.Activated', { templateId });
      
      // Update the template in the store
      const template = settings.getTemplate(templateId);
      if (template) {
        settings.updateTemplate(templateId, { isActive: true });
      }
      
      // Show success feedback
      alert('Template activated successfully!');
    } catch (error) {
      console.error('Error activating template:', error);
      alert('Error activating template. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = (templateId: string) => {
    setIsLoading(true);
    try {
      if (selectedTemplate) {
        settings.setDefaultTemplate(selectedTemplate.type, templateId);
        trackEvent('Template.SetDefault', { templateId, documentType: selectedTemplate.type });
        
        // Update the template in the store
        settings.updateTemplate(templateId, { isDefault: true });
        
        // Remove default from other templates of same type
        documentTemplates.forEach(template => {
          if (template.type === selectedTemplate.type && template.id !== templateId) {
            settings.updateTemplate(template.id, { isDefault: false });
          }
        });
        
        alert('Template set as default successfully!');
      }
    } catch (error) {
      console.error('Error setting default template:', error);
      alert('Error setting default template. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      setIsLoading(true);
      try {
        settings.deleteTemplate(templateId);
        trackEvent('Template.Deleted', { templateId });
        alert('Template deleted successfully!');
      } catch (error) {
        console.error('Error deleting template:', error);
        alert('Error deleting template. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveTemplate = (templateData: Partial<DocumentTemplate>) => {
    setIsLoading(true);
    try {
      if (selectedTemplate) {
        // Update existing template
        settings.updateTemplate(selectedTemplate.id, {
          ...templateData,
          updatedAt: new Date().toISOString()
        });
        trackEvent('Template.Updated', { templateId: selectedTemplate.id });
        alert('Template updated successfully!');
      } else {
        // Create new template
        const newTemplate: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
          name: templateData.name || 'New Template',
          type: templateData.type || 'receipt',
          category: templateData.category || 'financial',
          description: templateData.description || '',
          preview: templateData.preview || 'new-template',
          isActive: true,
          isDefault: false,
          variables: templateData.variables || [],
          styling: templateData.styling || {
            primaryColor: '#1e40af',
            secondaryColor: '#64748b',
            fontFamily: 'Inter',
            fontSize: '14px',
            logoPosition: 'top-left',
            headerStyle: 'professional',
            footerStyle: 'detailed'
          },
          compliance: templateData.compliance || {
            ghanaVAT: true,
            ghanaNHIL: true,
            ghanaTourismLevy: true,
            ssnit: false,
            incomeTax: false,
            customFields: {}
          },
          html: templateData.html || '<div>New Template</div>',
          css: templateData.css || '.new-template { }'
        };
        
        settings.addTemplate(newTemplate);
        trackEvent('Template.Created', { templateType: newTemplate.type });
        alert('Template created successfully!');
      }
      
      setIsEditModalOpen(false);
      setIsCreateModalOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize edit data when opening edit modal
  useEffect(() => {
    if (isEditModalOpen && selectedTemplate) {
      setEditData({ ...selectedTemplate });
      setEditVars([...(selectedTemplate.variables || [])]);
    }
  }, [isEditModalOpen, selectedTemplate]);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-blue-600">{documentTemplates.length}</div>
            <div className="text-sm text-gray-600">Total Templates</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {documentTemplates.filter(t => t.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Active Templates</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {documentTemplates.filter(t => t.isDefault).length}
            </div>
            <div className="text-sm text-gray-600">Default Templates</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {documentTemplates.filter(t => t.compliance.ghanaVAT).length}
            </div>
            <div className="text-sm text-gray-600">Ghana Compliant</div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Quick Actions</h3>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button color="primary" onClick={handleCreateTemplate} isLoading={isLoading}>
              Create New Template
            </Button>
            <Button color="secondary" variant="bordered">
              Import Templates
            </Button>
            <Button color="success" variant="bordered">Export Templates</Button>
            <Button color="warning" variant="bordered" onClick={handleOpenGallery}>Template Gallery</Button>
          </div>
        </CardBody>
      </Card>

      {/* Recent Templates */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recent Templates</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {documentTemplates.slice(0, 3).map((template) => (
              <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar name={template.name} size="sm" />
                  <div>
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-600">{template.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Chip size="sm" color={template.isActive ? 'success' : 'default'}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </Chip>
                  <Chip size="sm" color={template.isDefault ? 'primary' : 'default'}>
                    {template.isDefault ? 'Default' : 'Custom'}
                  </Chip>
                  <Button size="sm" variant="light" onClick={() => handlePreviewTemplate(template)}>
                    Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <Select label="Document Type" selectedKeys={[selectedDocumentType]} onSelectionChange={(keys) => setSelectedDocumentType(Array.from(keys)[0] as string)} className="min-w-48">
              {documentTypes.map((type) => (
                <SelectItem key={type.key}>{type.label}</SelectItem>
              ))}
            </Select>
            <Select
              label="Category"
              selectedKeys={[selectedCategory]}
              onSelectionChange={(keys) => setSelectedCategory(Array.from(keys)[0] as string)}
              className="min-w-48"
            >
              {categories.map((category) => (
                <SelectItem key={category.key}>
                  {category.label}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Purpose"
              selectedKeys={[selectedPurpose]}
              onSelectionChange={(keys) => setSelectedPurpose(Array.from(keys)[0] as string)}
              className="min-w-48"
            >
              {purposes.map((p) => (
                <SelectItem key={p.key}>{p.label}</SelectItem>
              ))}
            </Select>
            <Button color="primary" onClick={handleCreateTemplate} isLoading={isLoading}>
              Create Template
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Chip size="sm" color="primary" variant="flat">
                    {template.type}
                  </Chip>
                  <Chip size="sm" color="secondary" variant="flat">
                    {template.category}
                  </Chip>
                </div>
                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light">
                      ⋮
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu>
                    <DropdownItem key="preview" onClick={() => handlePreviewTemplate(template)}>
                      Preview
                    </DropdownItem>
                    <DropdownItem key="edit" onClick={() => handleEditTemplate(template)}>
                      Edit
                    </DropdownItem>
                    <DropdownItem key="activate" onClick={() => handleActivateTemplate(template.id)}>
                      {template.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownItem>
                    <DropdownItem key="default" onClick={() => handleSetDefault(template.id)}>
                      Set as Default
                    </DropdownItem>
                    <DropdownItem key="delete" color="danger" onClick={() => handleDeleteTemplate(template.id)}>
                      Delete
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-lg">{template.name}</h4>
                  <p className="text-sm text-gray-600">{template.description}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    isSelected={template.isActive}
                    onValueChange={() => handleActivateTemplate(template.id)}
                    size="sm"
                  />
                  <span className="text-sm">Active</span>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    isSelected={template.isDefault}
                    onValueChange={() => handleSetDefault(template.id)}
                    size="sm"
                  />
                  <span className="text-sm">Default</span>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Compliance:</div>
                  <div className="flex flex-wrap gap-1">
                    {template.compliance.ghanaVAT && (
                      <Chip size="sm" color="success" variant="flat">VAT</Chip>
                    )}
                    {template.compliance.ghanaNHIL && (
                      <Chip size="sm" color="success" variant="flat">NHIL</Chip>
                    )}
                    {template.compliance.ghanaTourismLevy && (
                      <Chip size="sm" color="success" variant="flat">Tourism</Chip>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" color="primary" variant="flat" onClick={() => handlePreviewTemplate(template)}>
                    Preview
                  </Button>
                  <Button size="sm" color="secondary" variant="flat" onClick={() => handleEditTemplate(template)}>
                    Edit
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* No Templates Message */}
      {filteredTemplates.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-gray-500">
              <div className="text-2xl mb-2">📄</div>
              <div className="text-lg font-medium mb-2">No templates found</div>
              <div className="text-sm mb-4">Try adjusting your filters or create a new template</div>
              <Button color="primary" onClick={handleCreateTemplate}>
                Create Your First Template
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Ghana Compliance Settings</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Tax Compliance</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Ghana VAT (12.5%)</span>
                    <Switch 
                      isSelected={settings.documentTemplates.complianceSettings.ghanaVAT}
                      onValueChange={(checked) => {
                        settings.updateDocumentTemplates({
                          complianceSettings: {
                            ...settings.documentTemplates.complianceSettings,
                            ghanaVAT: checked
                          }
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>NHIL (2.5%)</span>
                    <Switch 
                      isSelected={settings.documentTemplates.complianceSettings.ghanaNHIL}
                      onValueChange={(checked) => {
                        settings.updateDocumentTemplates({
                          complianceSettings: {
                            ...settings.documentTemplates.complianceSettings,
                            ghanaNHIL: checked
                          }
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tourism Levy (1%)</span>
                    <Switch 
                      isSelected={settings.documentTemplates.complianceSettings.ghanaTourismLevy}
                      onValueChange={(checked) => {
                        settings.updateDocumentTemplates({
                          complianceSettings: {
                            ...settings.documentTemplates.complianceSettings,
                            ghanaTourismLevy: checked
                          }
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Employment Compliance</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>SSNIT (5.5%)</span>
                    <Switch 
                      isSelected={settings.documentTemplates.complianceSettings.ssnit}
                      onValueChange={(checked) => {
                        settings.updateDocumentTemplates({
                          complianceSettings: {
                            ...settings.documentTemplates.complianceSettings,
                            ssnit: checked
                          }
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Income Tax (PAYE)</span>
                    <Switch 
                      isSelected={settings.documentTemplates.complianceSettings.incomeTax}
                      onValueChange={(checked) => {
                        settings.updateDocumentTemplates({
                          complianceSettings: {
                            ...settings.documentTemplates.complianceSettings,
                            incomeTax: checked
                          }
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Divider />

            <div>
              <h4 className="font-medium mb-3">Custom Compliance Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Field Name" placeholder="e.g., Local Council Tax" />
                <Input label="Field Value" placeholder="e.g., 2.5%" />
                <Button color="primary" size="sm">Add Field</Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderPreviewModal = () => (
    <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} size="4xl">
      <ModalContent>
        <ModalHeader>
          <h3 className="text-lg font-semibold">Template Preview: {selectedTemplate?.name}</h3>
        </ModalHeader>
        <ModalBody>
          {selectedTemplate && (
            <div className="space-y-6">
              {/* Template Preview */}
              <div className="border rounded-lg p-6 bg-gray-50">
                <div className="text-center text-gray-500 mb-4">
                  <div className="text-4xl mb-2">📄</div>
                  <div className="text-lg font-medium mb-2">Template Preview</div>
                  <div className="text-sm text-gray-600">
                    This is a preview of the "{selectedTemplate.name}" template
                  </div>
                </div>
                
                {/* Mock Template Display */}
                <div className="bg-white p-6 rounded border max-w-2xl mx-auto">
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-blue-600 mb-2">🏨 HOTEL NAME</div>
                    <div className="text-sm text-gray-600">123 Main Street, Accra, Ghana</div>
                  </div>
                  
                  <Divider className="my-4" />
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600">Guest Name:</div>
                      <div className="font-medium">John Doe</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Date:</div>
                      <div className="font-medium">15 Jan 2024</div>
                    </div>
                  </div>
                  
                  <Divider className="my-4" />
                  
                  <div className="text-right">
                    <div className="text-lg font-bold">Total: ₵ 1,000.00</div>
                    <div className="text-sm text-gray-600">VAT: ₵ 125.00</div>
                  </div>
                </div>
              </div>

              {/* Template Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Template Variables</h4>
                  <div className="space-y-2">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable.key} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                        <span className="text-sm">{variable.label}</span>
                        <Chip size="sm" color="secondary" variant="flat">
                          {variable.type}
                        </Chip>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Styling Options</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Primary Color</span>
                      <div className="w-6 h-6 rounded border" style={{ backgroundColor: selectedTemplate.styling.primaryColor }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Font Family</span>
                      <span className="text-sm font-medium">{selectedTemplate.styling.fontFamily}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Header Style</span>
                      <Chip size="sm" color="primary" variant="flat">
                        {selectedTemplate.styling.headerStyle}
                      </Chip>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={() => handleEditTemplate(selectedTemplate!)}>
            Edit Template
          </Button>
          <Button variant="bordered" onClick={() => setIsPreviewModalOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal isOpen={isEditModalOpen || isCreateModalOpen} onClose={() => { setIsEditModalOpen(false); setIsCreateModalOpen(false); }} size="4xl">
      <ModalContent>
        <ModalHeader>{selectedTemplate ? 'Edit Template' : 'Create Template'}</ModalHeader>
        <ModalBody>
          <Tabs selectedKey={selectedTab} onSelectionChange={(k) => setSelectedTab(k as string)}>
            <Tab key="basics" title="Basics" />
            <Tab key="styling" title="Styling" />
            <Tab key="compliance" title="Compliance" />
            <Tab key="variables" title="Variables" />
            <Tab key="code" title="Code" />
          </Tabs>
          <div className="mt-4 space-y-4">
            {selectedTab === 'basics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Name" value={String(editData.name || '')} onChange={(e)=> setEditData({ ...editData, name: e.target.value })} />
                <Select label="Type" selectedKeys={[String(editData.type || 'receipt')]} onSelectionChange={(keys)=> setEditData({ ...editData, type: Array.from(keys)[0] as any })}>
                  {['receipt','invoice','proforma','quotation','purchase-order','payment-order','contract','report'].map(t => (<SelectItem key={t}>{t}</SelectItem>))}
                </Select>
                <Select label="Category" selectedKeys={[String(editData.category || 'financial')]} onSelectionChange={(keys)=> setEditData({ ...editData, category: Array.from(keys)[0] as any })}>
                  {['financial','operational','legal','marketing'].map(c => (<SelectItem key={c}>{c}</SelectItem>))}
                </Select>
                <Select label="Purpose" selectedKeys={[String((editData as any).purpose || 'folio')]} onSelectionChange={(keys)=> setEditData((prev:any)=> ({ ...(prev as any), purpose: Array.from(keys)[0] as any }))}>
                  {['checkout','folio','accommodation','conference','restaurant','quotation'].map(p => (<SelectItem key={p}>{p}</SelectItem>))}
                </Select>
                <Textarea label="Description" value={String(editData.description || '')} onChange={(e)=> setEditData({ ...editData, description: e.target.value })} className="md:col-span-2" />
                <Switch isSelected={!!editData.isActive} onValueChange={(v)=> setEditData({ ...editData, isActive: v })}>Active</Switch>
                <Switch isSelected={!!editData.isDefault} onValueChange={(v)=> setEditData({ ...editData, isDefault: v })}>Default</Switch>
              </div>
            )}
            {selectedTab === 'styling' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Primary Color" value={String(editData.styling?.primaryColor || '')} onChange={(e)=> setEditData({ ...editData, styling: { ...(editData.styling as any), primaryColor: e.target.value } })} />
                <Input label="Secondary Color" value={String(editData.styling?.secondaryColor || '')} onChange={(e)=> setEditData({ ...editData, styling: { ...(editData.styling as any), secondaryColor: e.target.value } })} />
                <Input label="Font Family" value={String(editData.styling?.fontFamily || '')} onChange={(e)=> setEditData({ ...editData, styling: { ...(editData.styling as any), fontFamily: e.target.value } })} />
                <Input label="Font Size" value={String(editData.styling?.fontSize || '')} onChange={(e)=> setEditData({ ...editData, styling: { ...(editData.styling as any), fontSize: e.target.value } })} />
              </div>
            )}
            {selectedTab === 'compliance' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Switch isSelected={!!editData.compliance?.ghanaVAT} onValueChange={(v)=> setEditData({ ...editData, compliance: { ...(editData.compliance as any), ghanaVAT: v } })}>Ghana VAT</Switch>
                <Switch isSelected={!!editData.compliance?.ghanaNHIL} onValueChange={(v)=> setEditData({ ...editData, compliance: { ...(editData.compliance as any), ghanaNHIL: v } })}>NHIL</Switch>
                <Switch isSelected={!!editData.compliance?.ghanaTourismLevy} onValueChange={(v)=> setEditData({ ...editData, compliance: { ...(editData.compliance as any), ghanaTourismLevy: v } })}>Tourism Levy</Switch>
                <Switch isSelected={!!editData.compliance?.ssnit} onValueChange={(v)=> setEditData({ ...editData, compliance: { ...(editData.compliance as any), ssnit: v } })}>SSNIT</Switch>
              </div>
            )}
            {selectedTab === 'variables' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-medium">Variables</div>
                  <Button size="sm" onClick={()=> setEditVars([...editVars, { key: `var_${Date.now()}`, label: 'Label', type: 'text', required: false }])}>Add Variable</Button>
                </div>
                <div className="space-y-2">
                  {editVars.map((v, idx) => (
                    <div className="grid grid-cols-5 gap-2" key={idx}>
                      <Input label="Key" value={v.key} onChange={(e)=> { const arr=[...editVars]; arr[idx]={...v, key:e.target.value}; setEditVars(arr); }} />
                      <Input label="Label" value={v.label} onChange={(e)=> { const arr=[...editVars]; arr[idx]={...v, label:e.target.value}; setEditVars(arr); }} />
                      <Select label="Type" selectedKeys={[v.type]} onSelectionChange={(k)=> { const arr=[...editVars]; arr[idx]={...v, type:Array.from(k)[0]}; setEditVars(arr); }}>
                        {['text','number','date','select','boolean'].map(t=> (<SelectItem key={t}>{t}</SelectItem>))}
                      </Select>
                      <Switch isSelected={!!v.required} onValueChange={(val)=> { const arr=[...editVars]; arr[idx]={...v, required:val}; setEditVars(arr); }}>Required</Switch>
                      <Button size="sm" color="danger" variant="light" onClick={()=> { const arr=[...editVars]; arr.splice(idx,1); setEditVars(arr); }}>Remove</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedTab === 'code' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="HTML" minRows={10} value={String(editData.html || '')} onChange={(e)=> setEditData({ ...editData, html: e.target.value })} />
                <Textarea label="CSS" minRows={10} value={String(editData.css || '')} onChange={(e)=> setEditData({ ...editData, css: e.target.value })} />
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" onClick={() => { setIsEditModalOpen(false); setIsCreateModalOpen(false); }}>Cancel</Button>
          <Button color="primary" onPress={() => handleSaveTemplate({ ...editData, variables: editVars })}>Save</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const renderGalleryModal = () => {
    // Build gallery items from printTemplates registry (receipts, invoices, proformas)
    const gallery: Array<{ key: string; type: PrintType; name: string; purpose: string }> = [];
    (Object.keys(printTemplates) as PrintType[]).forEach((type) => {
      Object.keys(printTemplates[type]).forEach((key) => {
        // Infer purpose from key
        const lower = key.toLowerCase();
        const purpose = lower.includes('conference') ? 'conference' : lower.includes('restaurant') ? 'restaurant' : lower.includes('final') || lower.includes('checkout') || lower.includes('bill') ? 'checkout' : lower.includes('accommodation') ? 'accommodation' : lower.includes('proforma') || lower.includes('quote') ? 'quotation' : 'folio';
        gallery.push({ key, type, name: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), purpose });
      });
    });
    const importToStore = (g: { key: string; type: PrintType; name: string; purpose: string }) => {
      // Create a template from gallery entry with minimal HTML from renderer
      const html = renderPrint(g.type, g.key, {
        org: { name: 'Sample Hotel' },
        guest: { name: 'Guest' },
        items: [],
        totals: { subTotal: 0 },
      } as any);
      settings.addTemplate({
        name: g.name,
        type: g.type,
        category: 'financial',
        description: `Imported from gallery: ${g.key}`,
        purpose: g.purpose,
        preview: g.key,
        isActive: true,
        isDefault: false,
        variables: [],
        styling: { primaryColor: '#1e40af', secondaryColor: '#64748b', fontFamily: 'Inter', fontSize: '14px', logoPosition: 'top-left', headerStyle: 'professional', footerStyle: 'detailed' },
        compliance: { ghanaVAT: true, ghanaNHIL: true, ghanaTourismLevy: true, ssnit: false, incomeTax: false, customFields: {} },
        html,
        css: ''
      });
      alert(`Imported ${g.name} into your templates`);
    };
    const previewGallery = (g: { key: string; type: PrintType; name: string }) => {
      const html = renderPrint(g.type, g.key, {
        org: { name: 'Sample Hotel', address: '123 Main St, Accra' },
        guest: { name: 'John Doe' },
        items: [{ description: 'Sample Item', amount: 100 }],
        totals: { subTotal: 100, taxes: { vat: 12.5 }, payments: 0, balance: 112.5, grandTotal: 112.5 },
        currency: '₵'
      } as any);
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
    };
    return (
      <Modal isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} size="4xl">
        <ModalContent>
          <ModalHeader>Template Gallery</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gallery.map((g) => (
                <Card key={`${g.type}:${g.key}`} className="hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between w-full">
                      <div className="font-medium">{g.name}</div>
                      <Chip size="sm" color={g.type === 'receipt' ? 'success' : g.type === 'invoice' ? 'primary' : 'warning'} variant="flat">
                        {g.type}
                      </Chip>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="text-sm text-gray-600 mb-3">Purpose: {g.purpose}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="bordered" onClick={() => previewGallery(g)}>View</Button>
                      <Button size="sm" variant="flat" onClick={() => importToStore(g)}>Add to My Templates</Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onClick={() => setIsGalleryOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Template Builder</h1>
        <p className="text-gray-600 mt-2">
          Create and manage professional document templates for your hotel operations
        </p>
      </div>

      {/* Tabs */}
      <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)} className="w-full">
        <Tab key="overview" title="Overview" />
        <Tab key="templates" title="Templates" />
        <Tab key="builder" title="Builder" />
        <Tab key="compliance" title="Compliance" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'templates' && renderTemplates()}
        {selectedTab === 'builder' && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-1 space-y-3">
              <Card><CardBody className="space-y-2">
                <div className="font-medium">Blocks</div>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}', taxId:'{{org.taxId}}', style:{ align:'left', marginTop:0, marginBottom:8, showLine:false, lineWeight:1, lineColor:'#dddddd' } }])}>Org Header</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' }])}>Meta</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'guest', showRoom:true, showDates:true }])}>Guest Block</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'header', title:'Hotel Name', subtitle:'Address/Contact', titleSize:18, subtitleSize:12, style:{ align:'left', marginTop:0, marginBottom:8, showLine:false, lineWeight:1, lineColor:'#dddddd' } }])}>Header</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'text', content:'Paragraph text...' }])}>Text</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'table', columns:['Description','Qty','Rate','Amount'], rows:[['Item',1,100,100]] }])}>Static Table</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'items', columns:[{ label:'Description', bind:'description' },{ label:'Qty', bind:'qty', align:'right' },{ label:'Rate', bind:'unitPrice', align:'right' },{ label:'Amount', bind:'amount', align:'right' }] }])}>Items Repeater</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'totals', lines:[['Sub Total',0],['VAT (12.5%)',0],['Grand Total',0]] }])}>Totals</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'sectionTitle', text:'Section Title', style:{ align:'left', marginTop:8, marginBottom:6, showLine:false, lineWeight:1, lineColor:'#dddddd' } }])}>Section Title</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'columns2', left:'', right:'' }])}>Two Columns</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'notes', items:['Thank you for choosing us.'] }])}>Notes</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'divider', thickness:1, color:'#dddddd', marginTop:8, marginBottom:8 }])}>Divider</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'spacer', height:16 }])}>Spacer</Button>
                <Button size="sm" variant="flat" onClick={()=> setBuilderBlocks([...builderBlocks, { type:'signature', label:'Authorized By' }])}>Signature</Button>
                <Divider />
                <div className="font-medium">Presets</div>
                <Button size="sm" onClick={()=> setBuilderBlocks(presetCheckoutBill())}>Checkout Bill (Ghana)</Button>
                <Button size="sm" onClick={()=> setBuilderBlocks(presetConferenceGridProforma())}>Conference Proforma (Grid)</Button>
                <Button size="sm" onClick={()=> setBuilderBlocks(presetFinalBillAccommodation())}>Final Bill (Accommodation & Meals)</Button>
                <Button size="sm" onClick={()=> setBuilderBlocks(presetRestaurantInvoice())}>Restaurant Invoice</Button>
                <Button size="sm" onClick={()=> setBuilderBlocks(presetQuotationSimple())}>Quotation (Simple)</Button>
                <Divider />
                <Button size="sm" color="danger" variant="light" onClick={()=> setBuilderBlocks([])}>Clear</Button>
              </CardBody></Card>
              <Card><CardBody>
                <div className="flex gap-2">
                <Button size="sm" color="primary" onClick={()=> {
                  const compiled = compileBlocksToHtmlCss(builderBlocks);
                  setEditData((prev:any)=> ({ ...(prev||{}), html: compiled.html, css: compiled.css }));
                  alert('Compiled into Code tab. You can fine-tune HTML/CSS then Save.');
                  setSelectedTab('code');
                }}>Compile ➜ Code</Button>
                <Button size="sm" variant="bordered" onClick={()=> {
                  const compiled = compileBlocksToHtmlCss(builderBlocks);
                  openPreview(compiled.html, compiled.css);
                }}>Quick Preview</Button>
                </div>
              </CardBody></Card>
              <Card><CardBody>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Live Preview</div>
                  <Switch isSelected={showLivePreview} onValueChange={setShowLivePreview}>Show</Switch>
                </div>
                {showLivePreview && (
                  <div className="mt-3 border rounded overflow-hidden">
                    <iframe title="builder-preview" style={{width:'100%',height:480,border:'0'}} srcDoc={`<html><head><meta charset='utf-8' /><style>body{margin:0;padding:16px}</style>${compiledDoc.css?`<style>${compiledDoc.css}</style>`:''}</head><body>${compiledDoc.html}</body></html>`} />
                  </div>
                )}
              </CardBody></Card>
            </div>
            <div className="md:col-span-4">
              <Card><CardBody>
                <div className="space-y-3">
                  {builderBlocks.map((b, idx)=> (
                    <div key={idx} className={`border rounded p-3 ${selectedBlockIdx===idx? 'bg-default-50':''}`} onClick={()=> setSelectedBlockIdx(selectedBlockIdx===idx? null : idx)}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{b.type.toUpperCase()}</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="light">{selectedBlockIdx===idx? 'Done' : 'Edit'}</Button>
                          <Button size="sm" variant="light" onClick={()=> { if(idx===0) return; const arr=[...builderBlocks]; [arr[idx-1],arr[idx]]=[arr[idx],arr[idx-1]]; setBuilderBlocks(arr); }}>Up</Button>
                          <Button size="sm" variant="light" onClick={()=> { if(idx===builderBlocks.length-1) return; const arr=[...builderBlocks]; [arr[idx+1],arr[idx]]=[arr[idx],arr[idx+1]]; setBuilderBlocks(arr); }}>Down</Button>
                          <Button size="sm" color="danger" variant="light" onClick={()=> { const arr=[...builderBlocks]; arr.splice(idx,1); setBuilderBlocks(arr); if(selectedBlockIdx===idx) setSelectedBlockIdx(null); }}>Remove</Button>
                        </div>
                      </div>
                      {selectedBlockIdx!==idx && (
                        <div className="text-sm text-default-500">{renderBlockPreview(b)}</div>
                      )}
                      {selectedBlockIdx===idx && b.type==='orgHeader' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Name" value={b.name} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, name:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Logo URL" value={b.logoUrl} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, logoUrl:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Address" value={b.address} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, address:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Contact" value={b.contact} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, contact:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Tax ID" value={b.taxId} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, taxId:e.target.value}; setBuilderBlocks(arr); }} />
                          <Select label="Align" selectedKeys={[b.style?.align||'left']} onSelectionChange={(k:any)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), align:[...k][0]}}; setBuilderBlocks(arr); }}>
                            {(['left','center','right'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Top Margin" type="number" value={String(b.style?.marginTop??0)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginTop:parseInt(e.target.value||'0',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Bottom Margin" type="number" value={String(b.style?.marginBottom??8)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginBottom:parseInt(e.target.value||'0',10)}}; setBuilderBlocks(arr); }} />
                          <Select label="Underline" selectedKeys={[b.style?.showLine? 'yes':'no']} onSelectionChange={(k:any)=> { const val=[...k][0]==='yes'; const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), showLine:val}}; setBuilderBlocks(arr); }}>
                            {(['no','yes'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Line Weight" type="number" value={String(b.style?.lineWeight??1)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineWeight:parseInt(e.target.value||'1',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Line Color" value={b.style?.lineColor||'#dddddd'} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineColor:e.target.value}}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='meta' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Number" value={b.number} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, number:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Date" value={b.date} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, date:e.target.value}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='guest' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Show Room? true/false" value={String(b.showRoom)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, showRoom:e.target.value==='true'}; setBuilderBlocks(arr); }} />
                          <Input label="Show Dates? true/false" value={String(b.showDates)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, showDates:e.target.value==='true'}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='header' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Title" value={b.title} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, title:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Subtitle" value={b.subtitle} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, subtitle:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Title Size" type="number" value={String(b.titleSize??18)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, titleSize:parseInt(e.target.value||'18',10)}; setBuilderBlocks(arr); }} />
                          <Input label="Subtitle Size" type="number" value={String(b.subtitleSize??12)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, subtitleSize:parseInt(e.target.value||'12',10)}; setBuilderBlocks(arr); }} />
                          <Select label="Align" selectedKeys={[b.style?.align||'left']} onSelectionChange={(k:any)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), align:[...k][0]}}; setBuilderBlocks(arr); }}>
                            {(['left','center','right'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Top Margin" type="number" value={String(b.style?.marginTop??0)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginTop:parseInt(e.target.value||'0',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Bottom Margin" type="number" value={String(b.style?.marginBottom??8)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginBottom:parseInt(e.target.value||'0',10)}}; setBuilderBlocks(arr); }} />
                          <Select label="Underline" selectedKeys={[b.style?.showLine? 'yes':'no']} onSelectionChange={(k:any)=> { const val=[...k][0]==='yes'; const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), showLine:val}}; setBuilderBlocks(arr); }}>
                            {(['no','yes'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Line Weight" type="number" value={String(b.style?.lineWeight??1)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineWeight:parseInt(e.target.value||'1',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Line Color" value={b.style?.lineColor||'#dddddd'} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineColor:e.target.value}}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='text' && (
                        <Textarea label="Text" value={b.content} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, content:e.target.value}; setBuilderBlocks(arr); }} />
                      )}
                      {selectedBlockIdx===idx && b.type==='table' && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-4 gap-2">
                            {b.columns.map((c:string, ci:number)=> (
                              <Input key={ci} label={`Col ${ci+1}`} value={c} onChange={(e)=> { const arr=[...builderBlocks]; const cols=[...b.columns]; cols[ci]=e.target.value; arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }} />
                            ))}
                          </div>
                          <Button size="sm" onClick={()=> { const arr=[...builderBlocks]; const rows=[...b.rows, Array(b.columns.length).fill('')]; arr[idx]={...b, rows}; setBuilderBlocks(arr); }}>Add Row</Button>
                          <div className="space-y-1">
                            {b.rows.map((r:any[], ri:number)=> (
                              <div className="grid grid-cols-4 gap-2" key={ri}>
                                {r.map((cell:any, ci:number)=> (
                                  <Input key={ci} value={String(cell)} onChange={(e)=> { const arr=[...builderBlocks]; const rows=b.rows.map((row:any[], rix:number)=> rix===ri ? row.map((v:any, cix:number)=> cix===ci ? e.target.value : v) : row); arr[idx]={...b, rows}; setBuilderBlocks(arr); }} />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='items' && (
                        <div className="space-y-2">
                          <div className="space-y-2">
                            {b.columns.map((c:any, ci:number)=> (
                              <div className="grid grid-cols-3 gap-2" key={ci}>
                                <Input label="Label" value={c.label} onChange={(e)=> { const arr=[...builderBlocks]; const cols=[...b.columns]; cols[ci]={...c, label:e.target.value}; arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }} />
                                <Input label="Bind (e.g., description, qty)" value={c.bind} onChange={(e)=> { const arr=[...builderBlocks]; const cols=[...b.columns]; cols[ci]={...c, bind:e.target.value}; arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }} />
                                <Input label="Align (left/right)" value={c.align||''} onChange={(e)=> { const arr=[...builderBlocks]; const cols=[...b.columns]; cols[ci]={...c, align:e.target.value}; arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }} />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={()=> { const arr=[...builderBlocks]; const cols=[...b.columns, { label:'New', bind:'' }]; arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }}>Add Column</Button>
                            <Button size="sm" color="danger" variant="light" onClick={()=> { const arr=[...builderBlocks]; const cols=[...b.columns]; cols.pop(); arr[idx]={...b, columns:cols}; setBuilderBlocks(arr); }}>Remove Column</Button>
                          </div>
                          <div className="text-xs text-default-500">Rows will repeat for each item in data: items[]. Use binds like description, qty, unitPrice, amount.</div>
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='totals' && (
                        <div className="space-y-2">
                          {b.lines.map((ln:[string,number], li:number)=> (
                            <div className="grid grid-cols-3 gap-2" key={li}>
                              <Input label="Label" value={ln[0]} onChange={(e)=> { const arr=[...builderBlocks]; const lines=[...b.lines]; lines[li]=[e.target.value, ln[1]]; arr[idx]={...b, lines}; setBuilderBlocks(arr); }} />
                              <Input label="Amount" type="number" value={String(ln[1])} onChange={(e)=> { const arr=[...builderBlocks]; const lines=[...b.lines]; lines[li]=[ln[0], parseFloat(e.target.value||'0')]; arr[idx]={...b, lines}; setBuilderBlocks(arr); }} />
                              <Button size="sm" color="danger" variant="light" onClick={()=> { const arr=[...builderBlocks]; const lines=[...b.lines]; lines.splice(li,1); arr[idx]={...b, lines}; setBuilderBlocks(arr); }}>Remove</Button>
                            </div>
                          ))}
                          <Button size="sm" onClick={()=> { const arr=[...builderBlocks]; const lines=[...b.lines, ['New Line', 0]]; arr[idx]={...b, lines}; setBuilderBlocks(arr); }}>Add Line</Button>
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='sectionTitle' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Title" value={b.text} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, text:e.target.value}; setBuilderBlocks(arr); }} />
                          <Select label="Align" selectedKeys={[b.style?.align||'left']} onSelectionChange={(k:any)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), align:[...k][0]}}; setBuilderBlocks(arr); }}>
                            {(['left','center','right'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Top Margin" type="number" value={String(b.style?.marginTop??8)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginTop:parseInt(e.target.value||'8',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Bottom Margin" type="number" value={String(b.style?.marginBottom??6)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), marginBottom:parseInt(e.target.value||'6',10)}}; setBuilderBlocks(arr); }} />
                          <Select label="Underline" selectedKeys={[b.style?.showLine? 'yes':'no']} onSelectionChange={(k:any)=> { const val=[...k][0]==='yes'; const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), showLine:val}}; setBuilderBlocks(arr); }}>
                            {(['no','yes'] as const).map(v=> <SelectItem key={v}>{v}</SelectItem>) as any}
                          </Select>
                          <Input label="Line Weight" type="number" value={String(b.style?.lineWeight??1)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineWeight:parseInt(e.target.value||'1',10)}}; setBuilderBlocks(arr); }} />
                          <Input label="Line Color" value={b.style?.lineColor||'#dddddd'} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, style:{...(b.style||{}), lineColor:e.target.value}}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='columns2' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Textarea label="Left" value={b.left} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, left:e.target.value}; setBuilderBlocks(arr); }} />
                          <Textarea label="Right" value={b.right} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, right:e.target.value}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='notes' && (
                        <div className="space-y-2">
                          {b.items.map((t:string, ni:number)=> (
                            <div className="grid grid-cols-6 gap-2" key={ni}>
                              <Input className="col-span-5" value={t} onChange={(e)=> { const arr=[...builderBlocks]; const items=[...b.items]; items[ni]=e.target.value; arr[idx]={...b, items}; setBuilderBlocks(arr); }} />
                              <Button size="sm" color="danger" variant="light" onClick={()=> { const arr=[...builderBlocks]; const items=[...b.items]; items.splice(ni,1); arr[idx]={...b, items}; setBuilderBlocks(arr); }}>Remove</Button>
                            </div>
                          ))}
                          <Button size="sm" onClick={()=> { const arr=[...builderBlocks]; const items=[...b.items, '']; arr[idx]={...b, items}; setBuilderBlocks(arr); }}>Add Note</Button>
                        </div>
                      )}
                      {selectedBlockIdx===idx && b.type==='divider' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Thickness (px)" type="number" value={String(b.thickness??1)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, thickness:parseInt(e.target.value||'1',10)}; setBuilderBlocks(arr); }} />
                          <Input label="Color" value={b.color||'#dddddd'} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, color:e.target.value}; setBuilderBlocks(arr); }} />
                          <Input label="Top Margin" type="number" value={String(b.marginTop??8)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, marginTop:parseInt(e.target.value||'8',10)}; setBuilderBlocks(arr); }} />
                          <Input label="Bottom Margin" type="number" value={String(b.marginBottom??8)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, marginBottom:parseInt(e.target.value||'8',10)}; setBuilderBlocks(arr); }} />
                        </div>
                      )}
                      {b.type==='spacer' && (
                        <Input label="Height (px)" type="number" value={String(b.height)} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, height:parseInt(e.target.value||'0',10)}; setBuilderBlocks(arr); }} />
                      )}
                      {selectedBlockIdx===idx && b.type==='signature' && (
                        <Input label="Label" value={b.label} onChange={(e)=> { const arr=[...builderBlocks]; arr[idx]={...b, label:e.target.value}; setBuilderBlocks(arr); }} />
                      )}
                    </div>
                  ))}
                </div>
              </CardBody></Card>
            </div>
          </div>
        )}
        {selectedTab === 'compliance' && renderCompliance()}
      </div>

      {/* Modals */}
      {renderPreviewModal()}
      {renderEditModal()}
      {renderGalleryModal()}
    </div>
  );
}

// Compile blocks to HTML/CSS
function compileBlocksToHtmlCss(blocks: Array<any>): { html: string; css: string } {
  const parts: string[] = [];
  blocks.forEach((b) => {
    if (b.type === 'orgHeader') {
      const st = b.style || {};
      parts.push(`<div class="t-header" style="text-align:${st.align||'left'};margin:${st.marginTop||0}px 0 ${st.marginBottom||8}px 0"><div class="t-row"><div class="t-org">${escapeHtml(b.name||'')}</div>${b.taxId?`<div class=\"t-tax\">TIN: ${escapeHtml(b.taxId)}</div>`:''}</div>${b.logoUrl?`<img class=\"t-logo\" src=\"${escapeHtml(b.logoUrl)}\" />`:''}<div class="t-sub">${escapeHtml(b.address||'')} ${escapeHtml(b.contact||'')}</div>${st.showLine?`<div style=\"border-bottom:${st.lineWeight||1}px solid ${st.lineColor||'#ddd'};margin-top:6px\"></div>`:''}</div>`);
      return;
    }
    if (b.type === 'meta') {
      parts.push(`<div class="t-meta"><div>No.: ${escapeHtml(b.number||'')}</div><div>${escapeHtml(b.date||'')}</div></div>`);
      return;
    }
    if (b.type === 'guest') {
      parts.push(`<div class="t-guest"><div><div class=\"t-label\">Guest / Client</div><div>{{guest.name}}</div><div>{{guest.company}}</div></div><div>${b.showRoom?`<div>Room: {{guest.roomNumber}} • {{guest.roomType}}</div>`:''}${b.showDates?`<div>Arrival: {{guest.arrivalDate}} • Departure: {{guest.departureDate}} • Nights: {{guest.nights}}</div>`:''}</div></div>`);
      return;
    }
    if (b.type === 'header') {
      const st = b.style || {};
      parts.push(`<div class="t-header" style="text-align:${st.align||'left'};margin:${st.marginTop||0}px 0 ${st.marginBottom||8}px 0"><div class="t-title" style="font-size:${b.titleSize||18}px">${escapeHtml(b.title||'')}</div><div class="t-sub" style="font-size:${b.subtitleSize||12}px">${escapeHtml(b.subtitle||'')}</div>${st.showLine?`<div style=\"border-bottom:${st.lineWeight||1}px solid ${st.lineColor||'#ddd'};margin-top:6px\"></div>`:''}</div>`);
    } else if (b.type === 'text') {
      parts.push(`<div class="t-text">${escapeHtml(b.content||'')}</div>`);
    } else if (b.type === 'table') {
      const head = `<tr>${(b.columns||[]).map((c:string)=>`<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
      const body = (b.rows||[]).map((r:any[])=>`<tr>${r.map((v)=>`<td>${escapeHtml(String(v))}</td>`).join('')}</tr>`).join('');
      parts.push(`<table class="t-table"><thead>${head}</thead><tbody>${body}</tbody></table>`);
    } else if (b.type === 'items') {
      const head = `<tr>${(b.columns||[]).map((c:any)=>`<th${c.align==='right'? ' class=\"t-right\"':''}>${escapeHtml(c.label||'')}</th>`).join('')}</tr>`;
      const body = `{{#each items}}<tr>${(b.columns||[]).map((c:any)=>`<td${c.align==='right'? ' class=\"t-right\"':''}>{{${c.bind||''}}}</td>`).join('')}</tr>{{/each}}`;
      parts.push(`<table class="t-table"><thead>${head}</thead><tbody>${body}</tbody></table>`);
    } else if (b.type === 'totals') {
      const lines = (b.lines||[]).map((ln:[string,number])=>`<div class="t-line"><span>${escapeHtml(ln[0])}</span><span class="t-amt">${formatMoney(ln[1])}</span></div>`).join('');
      parts.push(`<div class="t-totals">${lines}</div>`);
    } else if (b.type === 'sectionTitle') {
      const st = b.style || {};
      parts.push(`<div class=\"t-section\" style=\"text-align:${st.align||'left'};margin:${st.marginTop||8}px 0 ${st.marginBottom||6}px 0\">${escapeHtml(b.text||'')}${st.showLine?`<div style=\\\"border-bottom:${st.lineWeight||1}px solid ${st.lineColor||'#ddd'};margin-top:6px\\\"></div>`:''}</div>`);
    } else if (b.type === 'columns2') {
      parts.push(`<div class=\"t-cols\"><div class=\"t-col\">${escapeHtml(b.left||'')}</div><div class=\"t-col\">${escapeHtml(b.right||'')}</div></div>`);
    } else if (b.type === 'notes') {
      parts.push(`<div class=\"t-notes\">${(b.items||[]).map((n:string)=>`<div>${escapeHtml(n)}</div>`).join('')}</div>`);
    } else if (b.type === 'divider') {
      parts.push(`<div style=\"border-top:${b.thickness||1}px solid ${b.color||'#ddd'};margin:${b.marginTop||8}px 0 ${b.marginBottom||8}px 0\"></div>`);
    } else if (b.type === 'spacer') {
      parts.push(`<div style=\"height:${Number(b.height||16)}px\"></div>`);
    } else if (b.type === 'signature') {
      parts.push(`<div class="t-sign"><div class="t-line"></div><div class="t-label">${escapeHtml(b.label||'Signature')}</div></div>`);
    }
  });
  const html = `<div class="t-doc">${parts.join('')}</div>`;
  const css = `.t-doc{font-family:Arial,system-ui; color:#111}.t-header{margin-bottom:8px}.t-title{font-size:18px;font-weight:700}.t-sub{font-size:12px;color:#666}.t-row{display:flex;gap:12px;align-items:center}.t-org{font-size:18px;font-weight:700}.t-tax{margin-left:auto;color:#666;font-size:12px}.t-logo{width:64px;height:64px;object-fit:contain}.t-meta{margin-left:auto;text-align:right;font-size:12px;color:#666}.t-text{margin:8px 0}.t-table{width:100%;border-collapse:collapse;margin-top:8px}.t-table th,.t-table td{border:1px solid #ddd;padding:6px;font-size:12px}.t-right{text-align:right}.t-totals{margin-top:8px}.t-totals .t-line{display:flex;justify-content:space-between}.t-section{font-weight:700;margin-top:12px}.t-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.t-notes{margin-top:8px;color:#666;font-size:12px}.t-hr{border:none;border-top:1px solid #ddd;margin:8px 0}.t-sign{margin-top:24px}.t-sign .t-line{border-bottom:1px solid #333;height:24px;width:220px}.t-sign .t-label{font-size:12px;color:#666;margin-top:4px}`;
  return { html, css };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' } as any)[c]);
}
function formatMoney(n: number) {
  return `₵${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function openPreview(html: string, css: string) {
  if (typeof window === 'undefined') return;
  const doc = `<html><head><meta charset=\"utf-8\" />${css ? `<style>${css}</style>` : ''}</head><body>${html}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

// Presets
function presetCheckoutBill() {
  return [
    { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}', taxId:'{{org.taxId}}' },
    { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' },
    { type:'guest', showRoom:true, showDates:true },
    { type:'sectionTitle', text:'Charges' },
    { type:'items', columns:[
      { label:'Description', bind:'description' },
      { label:'Qty', bind:'qty', align:'right' },
      { label:'Unit', bind:'unit' },
      { label:'Rate', bind:'unitPrice', align:'right' },
      { label:'Amount', bind:'amount', align:'right' }
    ]},
    { type:'sectionTitle', text:'Totals' },
    { type:'totals', lines:[
      ['Tax Exclusive Value', 0],
      ['GEFL (2.5%)', 0],
      ['NHIL (2.5%)', 0],
      ['COVID Levy (1%)', 0],
      ['Total Levy Inclusive', 0],
      ['VAT (12.5%)', 0],
      ['GTAL (1% of 0)', 0],
      ['Total Tax Inclusive', 0]
    ]},
    { type:'notes', items:['Thank you for choosing us'] },
    { type:'signature', label:'Authorized By' }
  ];
}

// Duplicate of renderBlockPreview removed (defined earlier)

function presetConferenceGridProforma() {
  return [
    { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}', taxId:'{{org.taxId}}' },
    { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' },
    { type:'sectionTitle', text:'Proforma Invoice for Accommodation and Conference Facilities' },
    { type:'text', content:'Dates grid can be represented using items with date and counts.' },
    { type:'items', columns:[
      { label:'Date', bind:'date' },
      { label:'Item', bind:'description' },
      { label:'Count', bind:'qty', align:'right' },
      { label:'Rate', bind:'unitPrice', align:'right' },
      { label:'Sub Total', bind:'amount', align:'right' }
    ]},
    { type:'totals', lines:[['Sub Total',0],['Taxes & Levies',0],['Grand Total',0]] },
    { type:'signature', label:'General Manager' }
  ];
}

function presetFinalBillAccommodation() {
  return [
    { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}', taxId:'{{org.taxId}}' },
    { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' },
    { type:'guest', showRoom:true, showDates:true },
    { type:'items', columns:[
      { label:'#', bind:'' },
      { label:'Description', bind:'description' },
      { label:'Day/Date', bind:'date' },
      { label:'Qty/# of persons', bind:'qty', align:'right' },
      { label:'Unit Price', bind:'unitPrice', align:'right' },
      { label:'Total Price', bind:'amount', align:'right' }
    ]},
    { type:'totals', lines:[['Total',0],['Payments',0],['Balance',0]] },
    { type:'signature', label:'Accounts Officer' }
  ];
}

function presetRestaurantInvoice() {
  return [
    { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}' },
    { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' },
    { type:'items', columns:[
      { label:'Item', bind:'description' },
      { label:'Qty', bind:'qty', align:'right' },
      { label:'Rate', bind:'unitPrice', align:'right' },
      { label:'Amount', bind:'amount', align:'right' }
    ]},
    { type:'totals', lines:[['Sub Total',0],['Tax',0],['Grand Total',0],['Payments',0],['Balance',0]] }
  ];
}

function presetQuotationSimple() {
  return [
    { type:'orgHeader', name:'{{org.name}}', logoUrl:'', address:'{{org.address}}', contact:'{{org.phone}} {{org.email}}' },
    { type:'meta', number:'{{docNumber}}', date:'{{docDate}}' },
    { type:'sectionTitle', text:'Quotation' },
    { type:'items', columns:[
      { label:'Description', bind:'description' },
      { label:'Qty', bind:'qty', align:'right' },
      { label:'Rate', bind:'unitPrice', align:'right' },
      { label:'Amount', bind:'amount', align:'right' }
    ]},
    { type:'totals', lines:[['Subtotal',0],['Taxes & Levies',0],['Grand Total',0]] },
    { type:'notes', items:['Bank Transfer/Payment details...', 'Quotation valid for 30 days.'] }
  ];
}

// Compact inline preview for collapsed blocks
function renderBlockPreview(b: any) {
  if (b.type === 'orgHeader') {
    return `${b.name || ''} • ${b.address || ''}`;
  }
  if (b.type === 'header') {
    return `${b.title || ''} — ${b.subtitle || ''}`;
  }
  if (b.type === 'sectionTitle') {
    return b.text || 'Section';
  }
  if (b.type === 'items') {
    return `Items table (${(b.columns||[]).length} cols)`;
  }
  if (b.type === 'table') {
    return `Static table (${(b.columns||[]).length} cols, ${(b.rows||[]).length} rows)`;
  }
  if (b.type === 'totals') {
    return `Totals (${(b.lines||[]).length} lines)`;
  }
  if (b.type === 'divider') {
    return `Divider ${b.thickness||1}px`;
  }
  if (b.type === 'spacer') {
    return `Spacer ${b.height||0}px`;
  }
  if (b.type === 'guest') {
    return 'Guest / Stay details';
  }
  if (b.type === 'meta') {
    return `No. ${b.number||''} • ${b.date||''}`;
  }
  if (b.type === 'text') {
    return (b.content||'').slice(0,80);
  }
  if (b.type === 'notes') {
    return `Notes (${(b.items||[]).length})`;
  }
  if (b.type === 'columns2') {
    return 'Two Columns';
  }
  if (b.type === 'signature') {
    return `Signature: ${b.label||''}`;
  }
  return b.type;
}
