'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/react';
import { Input } from '@heroui/react';
import { Select, SelectItem } from '@heroui/react';
import { Button } from '@heroui/react';
import { Switch } from '@heroui/react';
import { Chip } from '@heroui/react';
import { useComplianceStore } from '@/app/lib/compliance/store';

interface TaxCalculationPreviewProps {
  initialAmount?: number;
  roomTypeId?: string;
  guestType?: 'individual' | 'corporate' | 'diplomatic' | 'government';
  currency?: string;
  onTaxCalculated?: (calculation: TaxCalculationResult) => void;
}

interface TaxCalculationResult {
  subtotal: number;
  taxes: TaxBreakdown[];
  total: number;
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  isExempt: boolean;
  exemptionReason?: string;
  calculationDate: string;
}

interface TaxBreakdown {
  name: string;
  rate: number;
  amount: number;
  glCode: string;
  isExempt: boolean;
  exemptionReason?: string;
}

interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  lastUpdated: string;
}

const SUPPORTED_CURRENCIES: CurrencyRate[] = [
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', rate: 1.0, lastUpdated: new Date().toISOString() },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.083, lastUpdated: new Date().toISOString() },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.076, lastUpdated: new Date().toISOString() },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.065, lastUpdated: new Date().toISOString() },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: 75.0, lastUpdated: new Date().toISOString() },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', rate: 12.5, lastUpdated: new Date().toISOString() },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', rate: 1.55, lastUpdated: new Date().toISOString() },
];

const TAX_EXEMPTION_REASONS = {
  individual: ['None'],
  corporate: ['None', 'Export Business', 'Manufacturing', 'Agriculture', 'Tourism Investment'],
  diplomatic: ['Diplomatic Mission', 'International Organization', 'Embassy Staff'],
  government: ['Government Contract', 'Public Service', 'Development Project']
};

export default function TaxCalculationPreview({
  initialAmount = 1000,
  roomTypeId,
  guestType = 'individual',
  currency = 'GHS',
  onTaxCalculated
}: TaxCalculationPreviewProps) {
  const [amount, setAmount] = useState(initialAmount);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [selectedGuestType, setSelectedGuestType] = useState(guestType);
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [exemptionReason, setExemptionReason] = useState('');
  const [exemptionCertificate, setExemptionCertificate] = useState('');
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const { calculateTax, country } = useComplianceStore();

  // Calculate tax based on current settings
  const calculateTaxAmount = () => {
    if (!amount || amount <= 0) return;

    const baseAmount = amount;
    const selectedRate = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);
    
    if (!selectedRate) return;

    // Convert to GHS for tax calculation (Ghana taxes are always calculated in GHS)
    const amountInGHS = baseAmount * selectedRate.rate;
    
    // Get tax calculation from compliance store
    const taxResult = calculateTax(amountInGHS);
    
    // Apply exemptions if applicable
    let finalTaxes = taxResult.taxes;
    let isExempt = false;
    let exemptionReasonText = '';

    if (isTaxExempt && exemptionReason && exemptionReason !== 'None') {
      isExempt = true;
      exemptionReasonText = exemptionReason;
      
      // Apply exemptions based on guest type and reason
      if (selectedGuestType === 'corporate') {
        if (['Export Business', 'Manufacturing'].includes(exemptionReason)) {
          // Exempt from VAT and some levies
          finalTaxes = finalTaxes.map(tax => {
            if (['VAT (Standard Rate)', 'NHIL', 'GETFund Levy'].includes(tax.name)) {
              return { ...tax, isExempt: true, exemptionReason: exemptionReason };
            }
            return tax;
          });
        }
      } else if (selectedGuestType === 'diplomatic') {
        // Diplomatic missions are exempt from most taxes
        finalTaxes = finalTaxes.map(tax => ({
          ...tax,
          isExempt: true,
          exemptionReason: 'Diplomatic Immunity'
        }));
      } else if (selectedGuestType === 'government') {
        // Government contracts may have partial exemptions
        if (exemptionReason === 'Government Contract') {
          finalTaxes = finalTaxes.map(tax => {
            if (['Tourism Levy'].includes(tax.name)) {
              return { ...tax, isExempt: true, exemptionReason: 'Government Contract' };
            }
            return tax;
          });
        }
      }
    }

    const result: TaxCalculationResult = {
      subtotal: baseAmount,
      taxes: finalTaxes.map(tax => ({
        name: tax.name,
        rate: tax.rate,
        amount: tax.amount / selectedRate.rate, // Convert back to selected currency
        glCode: tax.glCode,
        isExempt: tax.isExempt || false,
        exemptionReason: tax.exemptionReason
      })),
      total: (amountInGHS + (isExempt ? 0 : taxResult.total - amountInGHS)) / selectedRate.rate,
      currency: selectedCurrency,
      exchangeRate: selectedRate.rate,
      baseCurrency: 'GHS',
      isExempt,
      exemptionReason: exemptionReasonText,
      calculationDate: new Date().toISOString()
    };

    setCalculationResult(result);
    onTaxCalculated?.(result);
  };

  useEffect(() => {
    calculateTaxAmount();
  }, [amount, selectedCurrency, selectedGuestType, isTaxExempt, exemptionReason]);

  const getCurrencySymbol = (currencyCode: string) => {
    return SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${amount.toFixed(2)}`;
  };

  const getExemptionColor = (isExempt: boolean) => {
    return isExempt ? 'success' : 'default';
  };

  const getTaxStatusIcon = (isExempt: boolean) => {
    return isExempt ? '✅' : '💰';
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-800">Tax Calculation Preview</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Amount"
              type="number"
              value={String(amount)}
              onChange={(e) => setAmount(Number(e.target.value))}
              startContent={getCurrencySymbol(selectedCurrency)}
              placeholder="Enter amount"
              className="font-mono"
            />
            
            <Select
              label="Currency"
              selectedKeys={[selectedCurrency]}
              onChange={(e) => setSelectedCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <SelectItem key={currency.code}>
                  {currency.symbol} {currency.name} ({currency.code})
                </SelectItem>
              ))}
            </Select>

            <Select
              label="Guest Type"
              selectedKeys={[selectedGuestType]}
              onChange={(e) => setSelectedGuestType(e.target.value as any)}
            >
              <SelectItem key="individual">Individual</SelectItem>
              <SelectItem key="corporate">Corporate</SelectItem>
              <SelectItem key="diplomatic">Diplomatic</SelectItem>
              <SelectItem key="government">Government</SelectItem>
            </Select>

            <div className="flex items-end">
              <Switch
                isSelected={isTaxExempt}
                onValueChange={setIsTaxExempt}
                color="success"
              >
                Tax Exempt
              </Switch>
            </div>
          </div>

          {/* Exemption Details */}
          {isTaxExempt && (
            <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800">Tax Exemption Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Exemption Reason"
                  selectedKeys={[exemptionReason]}
                  onChange={(e) => setExemptionReason(e.target.value)}
                  isRequired={isTaxExempt}
                >
                  {TAX_EXEMPTION_REASONS[selectedGuestType].map((reason) => (
                    <SelectItem key={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </Select>
                
                <Input
                  label="Certificate Number (Optional)"
                  value={exemptionCertificate}
                  onChange={(e) => setExemptionCertificate(e.target.value)}
                  placeholder="Exemption certificate number"
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tax Calculation Results */}
      {calculationResult && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Tax Calculation Results</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="light"
                onClick={() => setShowBreakdown(!showBreakdown)}
              >
                {showBreakdown ? 'Hide' : 'Show'} Breakdown
              </Button>
              <Chip
                color={calculationResult.isExempt ? 'success' : 'primary'}
                size="sm"
                variant="flat"
              >
                {calculationResult.isExempt ? 'EXEMPT' : 'TAXABLE'}
              </Chip>
            </div>
          </CardHeader>
          
          <CardBody>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(calculationResult.subtotal, calculationResult.currency)}
                </div>
                <div className="text-sm text-gray-600">Subtotal</div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(
                    calculationResult.taxes.reduce((sum, tax) => sum + (tax.isExempt ? 0 : tax.amount), 0),
                    calculationResult.currency
                  )}
                </div>
                <div className="text-sm text-gray-600">Total Tax</div>
              </div>
              
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculationResult.total, calculationResult.currency)}
                </div>
                <div className="text-sm text-gray-600">Total Amount</div>
              </div>
            </div>

            {/* Exchange Rate Info */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-800">
                <strong>Exchange Rate:</strong> 1 {calculationResult.baseCurrency} = {calculationResult.exchangeRate.toFixed(4)} {calculationResult.currency}
                <span className="text-xs text-blue-600 ml-2">
                  (Last updated: {new Date(calculationResult.calculationDate).toLocaleString()})
                </span>
              </div>
            </div>

            {/* Detailed Tax Breakdown */}
            {showBreakdown && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-800">Tax Breakdown</h4>
                <div className="space-y-2">
                  {calculationResult.taxes.map((tax, index) => (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-3 rounded-lg border ${
                        tax.isExempt ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTaxStatusIcon(tax.isExempt)}</span>
                        <div>
                          <div className="font-medium text-gray-800">{tax.name}</div>
                          <div className="text-sm text-gray-600">
                            Rate: {tax.rate}% | GL Code: {tax.glCode}
                          </div>
                          {tax.isExempt && tax.exemptionReason && (
                            <Chip size="sm" color="success" variant="flat">
                              Exempt: {tax.exemptionReason}
                            </Chip>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`font-mono text-lg ${
                          tax.isExempt ? 'text-green-600 line-through' : 'text-gray-800'
                        }`}>
                          {formatCurrency(tax.amount, calculationResult.currency)}
                        </div>
                        {tax.isExempt && (
                          <div className="text-sm text-green-600">Exempt</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exemption Summary */}
            {calculationResult.isExempt && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Exemption Summary</h4>
                <div className="text-sm text-green-700">
                  <p><strong>Reason:</strong> {calculationResult.exemptionReason}</p>
                  <p><strong>Guest Type:</strong> {selectedGuestType.charAt(0).toUpperCase() + selectedGuestType.slice(1)}</p>
                  {exemptionCertificate && (
                    <p><strong>Certificate:</strong> {exemptionCertificate}</p>
                  )}
                  <p><strong>Tax Savings:</strong> {formatCurrency(
                    calculationResult.taxes.reduce((sum, tax) => sum + (tax.isExempt ? tax.amount : 0), 0),
                    calculationResult.currency
                  )}</p>
                </div>
              </div>
            )}
          </CardBody>

          <CardFooter className="bg-gray-50">
            <div className="text-xs text-gray-600">
              <p><strong>Calculation Date:</strong> {new Date(calculationResult.calculationDate).toLocaleString()}</p>
              <p><strong>Country:</strong> {country} | <strong>Base Currency:</strong> {calculationResult.baseCurrency}</p>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
