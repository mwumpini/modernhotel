'use client';

import React, { useState, useEffect } from 'react';
import {
  Card, CardBody, CardHeader, Button, Badge, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Tabs, Tab, Chip, Select, SelectItem, Input, Textarea, Switch, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Divider, Avatar, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem
} from '@heroui/react';
import { useSettingsStore } from '../lib/settings/store';
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
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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

  const filteredTemplates = documentTemplates.filter(template => {
    const typeMatch = selectedDocumentType === 'all' || template.type === selectedDocumentType;
    const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory;
    return typeMatch && categoryMatch;
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
            <Button color="success" variant="bordered">
              Export Templates
            </Button>
            <Button color="warning" variant="bordered">
              Template Gallery
            </Button>
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
            <Select
              label="Document Type"
              selectedKeys={[selectedDocumentType]}
              onSelectionChange={(keys) => setSelectedDocumentType(Array.from(keys)[0] as string)}
              className="min-w-48"
            >
              {documentTypes.map((type) => (
                <SelectItem key={type.key}>
                  {type.label}
                </SelectItem>
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
        <Tab key="compliance" title="Compliance" />
      </Tabs>

      <div className="mt-6">
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'templates' && renderTemplates()}
        {selectedTab === 'compliance' && renderCompliance()}
      </div>

      {/* Modals */}
      {renderPreviewModal()}
    </div>
  );
}
