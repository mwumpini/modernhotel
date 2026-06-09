'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, Input, Select, SelectItem, Divider, Tooltip } from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { computeSalesTax } from '@/app/lib/tax/engine';

interface CheckoutProps {
  subtotal?: number;
  onComplete?: (total: number, taxes: Array<{ name: string; amount: number; glCode: string }>) => void;
}

const categories = [
  { key: 'ALL', label: 'General Goods/Services' },
  { key: 'FOOD', label: 'Food & Beverage' },
  { key: 'ROOM', label: 'Room Service' },
  { key: 'SERVICE', label: 'Service Charges' }
];

export default function Checkout({ subtotal: initialSubtotal = 0, onComplete }: CheckoutProps) {
  const [subtotal, setSubtotal] = useState(initialSubtotal);
  const [category, setCategory] = useState('ALL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [operation, setOperation] = useState<'external' | 'internal'>('external');
  
  const { country } = useComplianceStore();

  const { taxes, total } = useMemo(() => {
    const { lines, gross } = computeSalesTax(subtotal);
    return {
      taxes: lines.map((l) => ({ name: l.name, amount: l.amount, glCode: l.glAccountCode, rate: l.rate })),
      total: gross,
    };
  }, [subtotal]);

  const handlePayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add transaction to compliance store
    const { addTransaction } = useComplianceStore.getState();
    addTransaction({
      countryCode: country,
      transactionType: 'sale',
      amount: subtotal,
      taxAmount: taxes.reduce((sum, tax) => sum + tax.amount, 0),
      taxRules: taxes.map(tax => tax.name),
      reference: `TXN-${Date.now()}`,
      glCode: taxes[0]?.glCode || 'GL-0000',
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    
    if (onComplete) {
      onComplete(total, taxes);
    }
  };

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      'GH': '🇬🇭',
      'ZW': '🇿🇼',
      'US': '🇺🇸'
    };
    return flags[code] || '🌍';
  };

  return (
    <Card className="w-full max-w-md">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ghana-black">Checkout</h3>
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getCountryFlag(country)}</span>
            <span className="text-sm font-medium">{country}</span>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Subtotal"
            type="number"
            value={subtotal.toString()}
            onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
            startContent={
              <div className="pointer-events-none flex items-center">
                <span className="text-default-400 text-small">$</span>
              </div>
            }
            variant="bordered"
          />

          <Select
            label="Category"
            selectedKeys={[category]}
            onSelectionChange={(keys) => {
              const selectedKey = Array.from(keys)[0] as string;
              setCategory(selectedKey);
            }}
            variant="bordered"
          >
            {categories.map((cat) => (
              <SelectItem key={cat.key}>
                {cat.label}
              </SelectItem>
            ))}
          </Select>

          <Select
            label="Operation"
            selectedKeys={[operation]}
            onSelectionChange={(keys) => {
              const selectedKey = Array.from(keys)[0] as 'external' | 'internal';
              setOperation(selectedKey);
            }}
            variant="bordered"
          >
            <SelectItem key="external">External (Customer-facing)</SelectItem>
            <SelectItem key="internal">Internal (In-house)</SelectItem>
          </Select>

          <Divider />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            {taxes.map((tax, idx) => (
              <div key={`${tax.name}-${idx}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{tax.name}:</span>
                  <Tooltip content={`GL: ${tax.glCode} • Context: sales/${operation.toUpperCase()}`}>
                    <span aria-label="info" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-[10px] text-gray-700">i</span>
                  </Tooltip>
                </div>
                <span className="font-medium text-ghana-green">+${tax.amount.toFixed(2)}</span>
              </div>
            ))}
            
            <Divider />
            
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-ghana-green">${total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            className="w-full bg-ghana-green text-white"
            onPress={handlePayment}
            isLoading={isProcessing}
            isDisabled={subtotal <= 0}
          >
            {isProcessing ? 'Processing...' : 'Process Payment'}
          </Button>

          {taxes.length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Applied Tax Rules:</p>
              <div className="space-y-1">
                {taxes.map((tax, idx) => (
                  <div key={`${tax.name}-${idx}`} className="flex justify-between text-xs">
                    <span>{tax.name}</span>
                    <span className="font-mono">{tax.glCode}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
