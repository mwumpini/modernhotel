'use client';

import React, { useState, useEffect } from 'react';
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
  Chip,
  Divider,
  Textarea,
  Switch
} from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { TaxRule } from '@/app/lib/models';

interface TaxRuleForm {
  id: string;
  countryCode: string;
  name: string;
  rate: number;
  glCode: string;
  appliesTo: string[];
  description?: string;
  isActive: boolean;
}

const countries = [
  { code: 'GH', name: '🇬🇭 Ghana', flag: '🇬🇭' },
  { code: 'ZW', name: '🇿🇼 Zimbabwe', flag: '🇿🇼' },
  { code: 'US', name: '🇺🇸 United States', flag: '🇺🇸' },
  { code: 'NG', name: '🇳🇬 Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: '🇰🇪 Kenya', flag: '🇰🇪' },
  { code: 'ZA', name: '🇿🇦 South Africa', flag: '🇿🇦' }
];

const categories = [
  { key: 'ALL', label: 'All Products/Services' },
  { key: 'FOOD', label: 'Food & Beverage' },
  { key: 'ROOM', label: 'Room Service' },
  { key: 'SERVICE', label: 'Service Charges' },
  { key: 'HOTEL', label: 'Hotel Accommodation' },
  { key: 'RESTAURANT', label: 'Restaurant Services' },
  { key: 'BAR', label: 'Bar Services' },
  { key: 'SPA', label: 'Spa & Wellness' },
  { key: 'TRANSPORT', label: 'Transportation' }
];

const commonTaxTypes = [
  { name: 'VAT', description: 'Value Added Tax' },
  { name: 'Sales Tax', description: 'General Sales Tax' },
  { name: 'NHIL', description: 'National Health Insurance Levy' },
  { name: 'GETFund Levy', description: 'Ghana Education Trust Fund' },
  { name: 'COVID-19 Levy', description: 'COVID-19 Recovery Levy' },
  { name: 'Tourism Levy', description: 'Tourism Development Levy' },
  { name: 'Hotel Tax', description: 'Hotel Accommodation Tax' },
  { name: 'Income Tax', description: 'Income Tax' },
  { name: 'Service Tax', description: 'Service Tax' },
  { name: 'Import Duty', description: 'Import Duty' }
];

export default function TaxRateBuilder() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { taxRules, setCountry } = useComplianceStore();
  const [selectedCountry, setSelectedCountry] = useState('GH');
  const [editingRule, setEditingRule] = useState<TaxRuleForm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<TaxRuleForm>({
    id: '',
    countryCode: 'GH',
    name: '',
    rate: 0,
    glCode: '',
    appliesTo: ['ALL'],
    description: '',
    isActive: true
  });

  useEffect(() => {
    setCountry(selectedCountry);
  }, [selectedCountry, setCountry]);

  const handleOpenModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        id: rule.id,
        countryCode: rule.countryCode,
        name: rule.name,
        rate: rule.rate,
        glCode: rule.glCode,
        appliesTo: rule.appliesTo || ['ALL'],
        description: '',
        isActive: true
      });
      setIsEditMode(true);
    } else {
      setEditingRule(null);
      setFormData({
        id: '',
        countryCode: selectedCountry,
        name: '',
        rate: 0,
        glCode: '',
        appliesTo: ['ALL'],
        description: '',
        isActive: true
      });
      setIsEditMode(false);
    }
    onOpen();
  };

  const handleSave = async () => {
    try {
      const ruleData = {
        id: formData.id || undefined,
        countryCode: formData.countryCode,
        name: formData.name,
        rate: formData.rate,
        glCode: formData.glCode,
        appliesTo: formData.appliesTo
      };

      let response;
      if (isEditMode) {
        // Update existing rule
        response = await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData)
        });
      } else {
        // Create new rule
        response = await fetch('/api/compliance/taxes/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save tax rule');
      }

      const savedRule = await response.json();
      console.log('Tax rule saved:', savedRule);
      
      // Refresh the tax rules
      await setCountry(selectedCountry);
      
      onClose();
      setFormData({
        id: '',
        countryCode: selectedCountry,
        name: '',
        rate: 0,
        glCode: '',
        appliesTo: ['ALL'],
        description: '',
        isActive: true
      });
    } catch (error) {
      console.error('Error saving tax rule:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this tax rule?')) {
      try {
        const response = await fetch(`/api/compliance/taxes/manage?id=${ruleId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete tax rule');
        }

        const result = await response.json();
        console.log('Tax rule deleted:', result);
        
        // Refresh the tax rules
        await setCountry(selectedCountry);
      } catch (error) {
        console.error('Error deleting tax rule:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const getCountryFlag = (code: string) => {
    const country = countries.find(c => c.code === code);
    return country?.flag || '🌍';
  };

  const calculateTotalTax = (amount: number) => {
    const rules = taxRules.filter(rule => rule.countryCode === selectedCountry);
    if (selectedCountry === 'GH') {
      // Ghana-specific calculation
      const subtotal = amount;
      const levyRules = rules.filter(rule => 
        ['NHIL', 'GETFund Levy', 'COVID-19 Levy'].includes(rule.name)
      );
      const totalLevies = levyRules.reduce((sum, rule) => sum + (subtotal * rule.rate / 100), 0);
      const amountAfterLevies = subtotal + totalLevies;
      const vatRule = rules.find(rule => rule.name === 'VAT (Standard Rate)');
      const vatAmount = vatRule ? amountAfterLevies * (vatRule.rate / 100) : 0;
      const tourismRule = rules.find(rule => rule.name === 'Tourism Levy');
      const tourismAmount = tourismRule ? subtotal * (tourismRule.rate / 100) : 0;
      return subtotal + totalLevies + vatAmount + tourismAmount;
    } else {
      // Standard calculation
      const totalTax = rules.reduce((sum, rule) => sum + (amount * rule.rate / 100), 0);
      return amount + totalTax;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-ghana-black">Tax Rate Builder</h2>
          <p className="text-gray-600">Create and manage tax rules for different countries</p>
        </div>
        <Button 
          className="bg-ghana-green text-white"
          onPress={() => handleOpenModal()}
        >
          + Add Tax Rule
        </Button>
      </div>

      {/* Country Selector */}
      <Card>
        <CardBody>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Select Country:</span>
            <Select
              selectedKeys={[selectedCountry]}
              onSelectionChange={(keys) => {
                const selectedKey = Array.from(keys)[0] as string;
                setSelectedCountry(selectedKey);
              }}
              className="w-48"
              variant="bordered"
            >
              {countries.map((country) => (
                <SelectItem key={country.code}>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{country.flag}</span>
                    <span>{country.name}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Tax Rules Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Tax Rules for {getCountryFlag(selectedCountry)} {countries.find(c => c.code === selectedCountry)?.name}
            </h3>
            <Chip color="primary" variant="flat">
              {taxRules.filter(rule => rule.countryCode === selectedCountry).length} Rules
            </Chip>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Tax rules table">
            <TableHeader>
              <TableColumn>TAX NAME</TableColumn>
              <TableColumn>RATE</TableColumn>
              <TableColumn>GL CODE</TableColumn>
              <TableColumn>APPLIES TO</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {taxRules
                .filter(rule => rule.countryCode === selectedCountry)
                .map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-gray-500">{rule.description || 'No description'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip color="success" variant="flat">
                        {rule.rate}%
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {rule.glCode}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rule.appliesTo || ['ALL']).map((category) => (
                          <Chip key={category} size="sm" variant="bordered">
                            {categories.find(c => c.key === category)?.label || category}
                          </Chip>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="bordered"
                          onPress={() => handleOpenModal(rule)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="bordered"
                          onPress={() => handleDelete(rule.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Tax Calculator Preview */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Tax Calculator Preview</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Amount</label>
              <Input
                type="number"
                placeholder="100"
                defaultValue="100"
                onChange={(e) => {
                  const amount = parseFloat(e.target.value) || 0;
                  const total = calculateTotalTax(amount);
                  // Update preview in real-time
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Tax</label>
              <div className="text-2xl font-bold text-ghana-green">
                ${calculateTotalTax(100).toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Effective Rate</label>
              <div className="text-lg font-medium">
                {(((calculateTotalTax(100) - 100) / 100) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Tax Rule Form Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {isEditMode ? 'Edit Tax Rule' : 'Create New Tax Rule'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Country Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Country</label>
                  <Select
                    selectedKeys={[formData.countryCode]}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as string;
                      setFormData(prev => ({ ...prev, countryCode: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    {countries.map((country) => (
                      <SelectItem key={country.code}>
                        <div className="flex items-center space-x-2">
                          <span>{country.flag}</span>
                          <span>{country.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Active</label>
                  <div className="mt-2">
                    <Switch
                      isSelected={formData.isActive}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Tax Name */}
              <div>
                <label className="text-sm font-medium">Tax Name</label>
                <div className="mt-1">
                  <Select
                    selectedKeys={[formData.name]}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as string;
                      setFormData(prev => ({ ...prev, name: selectedKey }));
                    }}
                    variant="bordered"
                    placeholder="Select tax type or enter custom name"
                  >
                    {commonTaxTypes.map((taxType) => (
                      <SelectItem key={taxType.name}>
                        <div>
                          <p className="font-medium">{taxType.name}</p>
                          <p className="text-sm text-gray-500">{taxType.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <Input
                  className="mt-2"
                  placeholder="Or enter custom tax name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Rate and GL Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tax Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="15.0"
                    value={formData.rate.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">GL Code</label>
                  <Input
                    placeholder="2100"
                    value={formData.glCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, glCode: e.target.value }))}
                    variant="bordered"
                  />
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className="text-sm font-medium">Applies To Categories</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <div key={category.key} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={category.key}
                        checked={formData.appliesTo.includes(category.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              appliesTo: [...prev.appliesTo, category.key]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              appliesTo: prev.appliesTo.filter(c => c !== category.key)
                            }));
                          }
                        }}
                      />
                      <label htmlFor={category.key} className="text-sm">
                        {category.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  placeholder="Enter description for this tax rule..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  variant="bordered"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              className="bg-ghana-green text-white"
              onPress={handleSave}
              isDisabled={!formData.name || !formData.glCode}
            >
              {isEditMode ? 'Update Rule' : 'Create Rule'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
