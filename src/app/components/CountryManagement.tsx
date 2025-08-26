'use client';

import React, { useState } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
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
  Textarea
} from "@heroui/react";
import { useSettingsStore, CountryCompliance } from '../lib/settings/store';

export default function CountryManagement() {
  const { 
    defaultCountry,
    supportedCountries,
    countryCompliance,
    addCountry,
    updateCountryCompliance,
    removeCountry,
    updateNestedSetting
  } = useSettingsStore();
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [newCountry, setNewCountry] = useState<Partial<CountryCompliance>>({
    countryCode: '',
    countryName: '',
    currency: '',
    currencySymbol: '',
    timezone: '',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: '#,##0.00',
    taxRates: {},
    businessInfo: {
      name: '',
      address: '',
      phone: '',
      email: '',
    },
    compliance: {
      eInvoicing: false,
      taxReports: false,
      governmentIntegration: false,
      digitalSignature: false,
      auditTrail: true,
    },
    paymentMethods: {
      mobileMoney: false,
      bankTransfer: true,
      creditCard: true,
      cash: true,
      digitalWallet: false,
    },
    localization: {
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      numberFormat: '#,##0.00',
      currencyPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
    },
  });

  const handleAddCountry = () => {
    if (newCountry.countryCode && newCountry.countryName) {
      addCountry(newCountry.countryCode, newCountry as CountryCompliance);
      setNewCountry({
        countryCode: '',
        countryName: '',
        currency: '',
        currencySymbol: '',
        timezone: '',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: '#,##0.00',
        taxRates: {},
        businessInfo: {
          name: '',
          address: '',
          phone: '',
          email: '',
        },
        compliance: {
          eInvoicing: false,
          taxReports: false,
          governmentIntegration: false,
          digitalSignature: false,
          auditTrail: true,
        },
        paymentMethods: {
          mobileMoney: false,
          bankTransfer: true,
          creditCard: true,
          cash: true,
          digitalWallet: false,
        },
        localization: {
          language: 'en',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: 'HH:mm',
          numberFormat: '#,##0.00',
          currencyPosition: 'before',
          decimalSeparator: '.',
          thousandsSeparator: ',',
        },
      });
      onClose();
    }
  };

  const handleEditCountry = (countryCode: string) => {
    const country = countryCompliance[countryCode];
    if (country) {
      setNewCountry(country);
      setSelectedCountry(countryCode);
      setIsEditing(true);
      onOpen();
    }
  };

  const handleUpdateCountry = () => {
    if (selectedCountry && newCountry.countryCode) {
      updateCountryCompliance(selectedCountry, newCountry as CountryCompliance);
      setIsEditing(false);
      setSelectedCountry('');
      onClose();
    }
  };

  const handleRemoveCountry = (countryCode: string) => {
    if (countryCode !== defaultCountry) {
      removeCountry(countryCode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-ghana-black">Country Management</h3>
        <Button 
          color="primary" 
          className="bg-ghana-green text-white"
          onClick={() => {
            setIsEditing(false);
            setSelectedCountry('');
            onOpen();
          }}
        >
          🌍 Add Country
        </Button>
      </div>

      {/* Default Country Selection */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h4 className="text-lg font-semibold text-ghana-black">Default Country</h4>
        </CardHeader>
        <CardBody>
          <Select
            label="Default Country"
            selectedKeys={[defaultCountry]}
            onSelectionChange={(keys) => {
              const country = Array.from(keys as Set<string>)[0];
              if (country) {
                updateNestedSetting('defaultCountry', country);
              }
            }}
            className="max-w-xs"
          >
            {supportedCountries.map((countryCode) => {
              const country = countryCompliance[countryCode];
              return (
                <SelectItem key={countryCode} value={countryCode}>
                  {country?.countryName || countryCode}
                </SelectItem>
              );
            })}
          </Select>
          <p className="text-sm text-gray-600 mt-2">
            The default country determines the currency, tax rates, and compliance settings used throughout the system.
          </p>
        </CardBody>
      </Card>

      {/* Countries Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <h4 className="text-lg font-semibold text-ghana-black">Supported Countries</h4>
        </CardHeader>
        <CardBody>
          <Table aria-label="Countries table">
            <TableHeader>
              <TableColumn>COUNTRY</TableColumn>
              <TableColumn>CURRENCY</TableColumn>
              <TableColumn>TIMEZONE</TableColumn>
              <TableColumn>COMPLIANCE</TableColumn>
              <TableColumn>PAYMENT METHODS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {supportedCountries.map((countryCode) => {
                const country = countryCompliance[countryCode];
                if (!country) return null;
                
                return (
                  <TableRow key={countryCode}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{country.countryName}</p>
                        <p className="text-sm text-gray-600">{countryCode}</p>
                        {countryCode === defaultCountry && (
                          <Chip size="sm" color="primary" className="mt-1">Default</Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{country.currency}</p>
                        <p className="text-sm text-gray-600">{country.currencySymbol}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{country.timezone}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {country.compliance.eInvoicing && <Chip size="sm" color="success">E-Invoice</Chip>}
                        {country.compliance.taxReports && <Chip size="sm" color="warning">Tax Reports</Chip>}
                        {country.compliance.governmentIntegration && <Chip size="sm" color="primary">Gov API</Chip>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {country.paymentMethods.mobileMoney && <Chip size="sm" variant="flat">Mobile Money</Chip>}
                        {country.paymentMethods.creditCard && <Chip size="sm" variant="flat">Cards</Chip>}
                        {country.paymentMethods.cash && <Chip size="sm" variant="flat">Cash</Chip>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onClick={() => handleEditCountry(countryCode)}
                        >
                          Edit
                        </Button>
                        {countryCode !== defaultCountry && (
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onClick={() => handleRemoveCountry(countryCode)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Add/Edit Country Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {isEditing ? 'Edit Country Configuration' : 'Add New Country'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Country Code"
                  placeholder="e.g., GH, US, UK"
                  value={newCountry.countryCode}
                  onChange={(e) => setNewCountry({...newCountry, countryCode: e.target.value})}
                  isDisabled={isEditing}
                />
                <Input
                  label="Country Name"
                  placeholder="e.g., Ghana, United States"
                  value={newCountry.countryName}
                  onChange={(e) => setNewCountry({...newCountry, countryName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Currency Code"
                  placeholder="e.g., GHS, USD"
                  value={newCountry.currency}
                  onChange={(e) => setNewCountry({...newCountry, currency: e.target.value})}
                />
                <Input
                  label="Currency Symbol"
                  placeholder="e.g., ₵, $"
                  value={newCountry.currencySymbol}
                  onChange={(e) => setNewCountry({...newCountry, currencySymbol: e.target.value})}
                />
                <Input
                  label="Timezone"
                  placeholder="e.g., Africa/Accra"
                  value={newCountry.timezone}
                  onChange={(e) => setNewCountry({...newCountry, timezone: e.target.value})}
                />
              </div>

              <Divider />

              {/* Tax Configuration */}
              <div>
                <h5 className="font-semibold mb-3">Tax Configuration</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="VAT Rate (%)"
                    type="number"
                    step="0.1"
                    value={newCountry.taxRates?.vat || ''}
                    onChange={(e) => setNewCountry({
                      ...newCountry, 
                      taxRates: {...newCountry.taxRates, vat: parseFloat(e.target.value) || 0}
                    })}
                  />
                  <Input
                    label="GST Rate (%)"
                    type="number"
                    step="0.1"
                    value={newCountry.taxRates?.gst || ''}
                    onChange={(e) => setNewCountry({
                      ...newCountry, 
                      taxRates: {...newCountry.taxRates, gst: parseFloat(e.target.value) || 0}
                    })}
                  />
                  <Input
                    label="Sales Tax (%)"
                    type="number"
                    step="0.1"
                    value={newCountry.taxRates?.salesTax || ''}
                    onChange={(e) => setNewCountry({
                      ...newCountry, 
                      taxRates: {...newCountry.taxRates, salesTax: parseFloat(e.target.value) || 0}
                    })}
                  />
                </div>
              </div>

              <Divider />

              {/* Business Information */}
              <div>
                <h5 className="font-semibold mb-3">Business Information</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Business Name"
                    value={newCountry.businessInfo?.name || ''}
                    onChange={(e) => setNewCountry({
                      ...newCountry, 
                      businessInfo: {...newCountry.businessInfo, name: e.target.value}
                    })}
                  />
                  <Input
                    label="Tax ID"
                    value={newCountry.businessInfo?.taxId || ''}
                    onChange={(e) => setNewCountry({
                      ...newCountry, 
                      businessInfo: {...newCountry.businessInfo, taxId: e.target.value}
                    })}
                  />
                </div>
                <Textarea
                  label="Business Address"
                  className="mt-4"
                  value={newCountry.businessInfo?.address || ''}
                  onChange={(e) => setNewCountry({
                    ...newCountry, 
                    businessInfo: {...newCountry.businessInfo, address: e.target.value}
                  })}
                />
              </div>

              <Divider />

              {/* Compliance Features */}
              <div>
                <h5 className="font-semibold mb-3">Compliance Features</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">E-Invoicing</h6>
                      <p className="text-sm text-gray-600">Generate compliant e-invoices</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.compliance?.eInvoicing}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        compliance: {...newCountry.compliance, eInvoicing: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Tax Reports</h6>
                      <p className="text-sm text-gray-600">Automated tax reporting</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.compliance?.taxReports}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        compliance: {...newCountry.compliance, taxReports: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Government Integration</h6>
                      <p className="text-sm text-gray-600">Direct API integration</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.compliance?.governmentIntegration}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        compliance: {...newCountry.compliance, governmentIntegration: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Digital Signature</h6>
                      <p className="text-sm text-gray-600">Digital document signing</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.compliance?.digitalSignature}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        compliance: {...newCountry.compliance, digitalSignature: value}
                      })}
                    />
                  </div>
                </div>
              </div>

              <Divider />

              {/* Payment Methods */}
              <div>
                <h5 className="font-semibold mb-3">Payment Methods</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Mobile Money</h6>
                      <p className="text-sm text-gray-600">Mobile payment support</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.paymentMethods?.mobileMoney}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        paymentMethods: {...newCountry.paymentMethods, mobileMoney: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Credit Cards</h6>
                      <p className="text-sm text-gray-600">Card payment processing</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.paymentMethods?.creditCard}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        paymentMethods: {...newCountry.paymentMethods, creditCard: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Bank Transfer</h6>
                      <p className="text-sm text-gray-600">Direct bank transfers</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.paymentMethods?.bankTransfer}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        paymentMethods: {...newCountry.paymentMethods, bankTransfer: value}
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h6 className="font-medium">Digital Wallets</h6>
                      <p className="text-sm text-gray-600">Digital wallet support</p>
                    </div>
                    <Switch 
                      isSelected={newCountry.paymentMethods?.digitalWallet}
                      onValueChange={(value) => setNewCountry({
                        ...newCountry, 
                        paymentMethods: {...newCountry.paymentMethods, digitalWallet: value}
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              className="bg-ghana-green text-white"
              onPress={isEditing ? handleUpdateCountry : handleAddCountry}
            >
              {isEditing ? 'Update Country' : 'Add Country'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
