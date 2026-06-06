'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/react';
import { Input } from '@heroui/react';
import { Button } from '@heroui/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { Chip } from '@heroui/react';
import { Tooltip } from '@heroui/react';
import { Select, SelectItem } from '@heroui/react';
import { Switch } from '@heroui/react';

interface CurrencyRate {
  id: string;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  previousRate: number;
  change24h: number;
  changePercent: number;
  lastUpdated: string;
  isActive: boolean;
  source: 'manual' | 'api' | 'bank';
  updateFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
}

interface ExchangeRateHistory {
  date: string;
  rate: number;
  source: string;
  notes?: string;
}

const DEFAULT_CURRENCIES: Omit<CurrencyRate, 'id' | 'lastUpdated' | 'previousRate' | 'change24h' | 'changePercent'>[] = [
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', rate: 1.0, isActive: true, source: 'manual', updateFrequency: 'manual' },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 0.083, isActive: true, source: 'api', updateFrequency: 'realtime' },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.076, isActive: true, source: 'api', updateFrequency: 'hourly' },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.065, isActive: true, source: 'api', updateFrequency: 'hourly' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: 75.0, isActive: true, source: 'bank', updateFrequency: 'daily' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', rate: 12.5, isActive: true, source: 'bank', updateFrequency: 'daily' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', rate: 1.55, isActive: true, source: 'api', updateFrequency: 'hourly' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 0.60, isActive: false, source: 'manual', updateFrequency: 'manual' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 6.90, isActive: false, source: 'manual', updateFrequency: 'manual' },
];

export default function CurrencyExchangeManager() {
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyRate | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState({
    code: '',
    name: '',
    symbol: '',
    rate: 0,
    source: 'manual' as const,
    updateFrequency: 'manual' as const,
    isActive: true
  });
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [conversionAmount, setConversionAmount] = useState(1000);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  useEffect(() => {
    // Initialize with default currencies
    const initializedCurrencies = DEFAULT_CURRENCIES.map((currency, index) => ({
      ...currency,
      id: `currency-${index}`,
      lastUpdated: new Date().toISOString(),
      previousRate: currency.rate,
      change24h: 0,
      changePercent: 0
    }));
    setCurrencies(initializedCurrencies);
  }, []);

  // Simulate real-time updates
  useEffect(() => {
    if (!autoUpdateEnabled) return;

    const interval = setInterval(() => {
      setCurrencies(prev => prev.map(currency => {
        if (currency.updateFrequency === 'realtime' && currency.isActive) {
          // Simulate small rate fluctuations
          const fluctuation = (Math.random() - 0.5) * 0.001; // ±0.1% change
          const newRate = currency.rate * (1 + fluctuation);
          return {
            ...currency,
            previousRate: currency.rate,
            rate: newRate,
            change24h: newRate - currency.previousRate,
            changePercent: ((newRate - currency.previousRate) / currency.previousRate) * 100,
            lastUpdated: new Date().toISOString()
          };
        }
        return currency;
      }));
      setLastSyncTime(new Date());
    }, 30000); // Update every 30 seconds for real-time currencies

    return () => clearInterval(interval);
  }, [autoUpdateEnabled]);

  const handleAddCurrency = () => {
    if (!newCurrency.code || !newCurrency.name || !newCurrency.symbol || newCurrency.rate <= 0) {
      return;
    }

    const currency: CurrencyRate = {
      id: `currency-${Date.now()}`,
      code: newCurrency.code.toUpperCase(),
      name: newCurrency.name,
      symbol: newCurrency.symbol,
      rate: newCurrency.rate,
      previousRate: newCurrency.rate,
      change24h: 0,
      changePercent: 0,
      lastUpdated: new Date().toISOString(),
      isActive: newCurrency.isActive,
      source: newCurrency.source,
      updateFrequency: newCurrency.updateFrequency
    };

    setCurrencies(prev => [...prev, currency]);
    setNewCurrency({ code: '', name: '', symbol: '', rate: 0, source: 'manual', updateFrequency: 'manual', isActive: true });
    setIsAddModalOpen(false);
  };

  const handleEditCurrency = (currency: CurrencyRate) => {
    setEditingCurrency(currency);
    setIsEditModalOpen(true);
  };

  const handleUpdateCurrency = () => {
    if (!editingCurrency) return;

    setCurrencies(prev => prev.map(curr => 
      curr.id === editingCurrency.id ? editingCurrency : curr
    ));
    setEditingCurrency(null);
    setIsEditModalOpen(false);
  };

  const handleToggleCurrency = (currencyId: string) => {
    setCurrencies(prev => prev.map(curr => 
      curr.id === currencyId ? { ...curr, isActive: !curr.isActive } : curr
    ));
  };

  const handleManualUpdate = (currencyId: string, newRate: number) => {
    setCurrencies(prev => prev.map(curr => {
      if (curr.id === currencyId) {
        return {
          ...curr,
          previousRate: curr.rate,
          rate: newRate,
          change24h: newRate - curr.rate,
          changePercent: ((newRate - curr.rate) / curr.rate) * 100,
          lastUpdated: new Date().toISOString(),
          source: 'manual'
        };
      }
      return curr;
    }));
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'success';
    if (change < 0) return 'danger';
    return 'default';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗️';
    if (change < 0) return '↘️';
    return '→';
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'api': return 'primary';
      case 'bank': return 'secondary';
      case 'manual': return 'warning';
      default: return 'default';
    }
  };

  const getUpdateFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'realtime': return 'success';
      case 'hourly': return 'primary';
      case 'daily': return 'secondary';
      case 'manual': return 'warning';
      default: return 'default';
    }
  };

  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string) => {
    const from = currencies.find(c => c.code === fromCurrency);
    const to = currencies.find(c => c.code === toCurrency);
    
    if (!from || !to) return 0;
    
    // Convert through GHS (base currency)
    const amountInGHS = amount / from.rate;
    return amountInGHS * to.rate;
  };

  const selectedCurrencyData = currencies.find(c => c.code === selectedCurrency);

  return (
    <div className="space-y-6">
      {/* Header with Auto-update toggle */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Currency Exchange Manager</h2>
            <p className="text-gray-600">Manage multi-currency exchange rates and conversions</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Last Sync</div>
              <div className="text-xs text-gray-500">{lastSyncTime.toLocaleTimeString()}</div>
            </div>
            <Switch
              isSelected={autoUpdateEnabled}
              onValueChange={setAutoUpdateEnabled}
              color="success"
            >
              Auto-update
            </Switch>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Currency Converter */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Quick Currency Converter</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <Input
              label="Amount"
              type="number"
              value={String(conversionAmount)}
              onChange={(e) => setConversionAmount(Number(e.target.value))}
              startContent={selectedCurrencyData?.symbol}
              placeholder="Enter amount"
            />
            
            <Select
              label="From Currency"
              selectedKeys={[selectedCurrency]}
              onChange={(e) => setSelectedCurrency(e.target.value)}
            >
              {currencies.filter(c => c.isActive).map((currency) => (
                <SelectItem key={currency.code}>
                  {currency.symbol} {currency.code}
                </SelectItem>
              ))}
            </Select>

            <div className="text-center">
              <div className="text-2xl">→</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {selectedCurrencyData && convertCurrency(conversionAmount, selectedCurrency, 'GHS').toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">GHS (Base)</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Currency Rates Table */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Exchange Rates</h3>
          <Button
            color="primary"
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Currency
          </Button>
        </CardHeader>
        <CardBody>
          <Table aria-label="Currency exchange rates">
            <TableHeader>
              <TableColumn>Currency</TableColumn>
              <TableColumn>Rate (GHS)</TableColumn>
              <TableColumn>24h Change</TableColumn>
              <TableColumn>Source</TableColumn>
              <TableColumn>Update Frequency</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{currency.symbol}</span>
                      <div>
                        <div className="font-medium">{currency.code}</div>
                        <div className="text-sm text-gray-500">{currency.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="font-mono">
                      {currency.rate.toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Updated: {new Date(currency.lastUpdated).toLocaleTimeString()}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span>{getChangeIcon(currency.changePercent)}</span>
                      <Chip
                        size="sm"
                        color={getChangeColor(currency.changePercent)}
                        variant="flat"
                      >
                        {currency.changePercent > 0 ? '+' : ''}{currency.changePercent.toFixed(2)}%
                      </Chip>
                    </div>
                    <div className="text-xs text-gray-500">
                      {currency.change24h > 0 ? '+' : ''}{currency.change24h.toFixed(4)}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      size="sm"
                      color={getSourceColor(currency.source)}
                      variant="flat"
                    >
                      {currency.source.toUpperCase()}
                    </Chip>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      size="sm"
                      color={getUpdateFrequencyColor(currency.updateFrequency)}
                      variant="flat"
                    >
                      {currency.updateFrequency}
                    </Chip>
                  </TableCell>
                  
                  <TableCell>
                    <Switch
                      isSelected={currency.isActive}
                      onValueChange={() => handleToggleCurrency(currency.id)}
                      color="success"
                      size="sm"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex gap-2">
                      <Tooltip content="Edit currency">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => handleEditCurrency(currency)}
                        >
                          ✏️
                        </Button>
                      </Tooltip>
                      
                      <Tooltip content="Manual update">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            const newRate = prompt(`Enter new rate for ${currency.code}:`, currency.rate.toString());
                            if (newRate && !isNaN(Number(newRate))) {
                              handleManualUpdate(currency.id, Number(newRate));
                            }
                          }}
                        >
                          🔄
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

      {/* Add Currency Modal */}
      {isAddModalOpen && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <h3 className="text-lg font-semibold">Add New Currency</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Currency Code"
                value={newCurrency.code}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g., JPY"
                maxLength={3}
              />
              
              <Input
                label="Currency Name"
                value={newCurrency.name}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Japanese Yen"
              />
              
              <Input
                label="Symbol"
                value={newCurrency.symbol}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, symbol: e.target.value }))}
                placeholder="e.g., ¥"
                maxLength={5}
              />
              
              <Input
                label="Exchange Rate (to GHS)"
                type="number"
                step="0.0001"
                value={String(newCurrency.rate)}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, rate: Number(e.target.value) }))}
                placeholder="e.g., 0.0123"
              />
              
              <Select
                label="Source"
                selectedKeys={[newCurrency.source]}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, source: e.target.value as any }))}
              >
                <SelectItem key="manual">Manual</SelectItem>
                <SelectItem key="api">API</SelectItem>
                <SelectItem key="bank">Bank</SelectItem>
              </Select>
              
              <Select
                label="Update Frequency"
                selectedKeys={[newCurrency.updateFrequency]}
                onChange={(e) => setNewCurrency(prev => ({ ...prev, updateFrequency: e.target.value as any }))}
              >
                <SelectItem key="manual">Manual</SelectItem>
                <SelectItem key="daily">Daily</SelectItem>
                <SelectItem key="hourly">Hourly</SelectItem>
                <SelectItem key="realtime">Real-time</SelectItem>
              </Select>
              
              <Switch
                isSelected={newCurrency.isActive}
                onValueChange={(checked) => setNewCurrency(prev => ({ ...prev, isActive: checked }))}
                color="success"
              >
                Active
              </Switch>
            </CardBody>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="light"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onClick={handleAddCurrency}
              >
                Add Currency
              </Button>
            </CardFooter>
          </Card>
        </Card>
      )}

      {/* Edit Currency Modal */}
      {isEditModalOpen && editingCurrency && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <h3 className="text-lg font-semibold">Edit Currency: {editingCurrency.code}</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Currency Name"
                value={editingCurrency.name}
                onChange={(e) => setEditingCurrency(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
              
              <Input
                label="Symbol"
                value={editingCurrency.symbol}
                onChange={(e) => setEditingCurrency(prev => prev ? { ...prev, symbol: e.target.value } : null)}
                maxLength={5}
              />
              
              <Input
                label="Exchange Rate (to GHS)"
                type="number"
                step="0.0001"
                value={String(editingCurrency.rate)}
                onChange={(e) => setEditingCurrency(prev => prev ? { ...prev, rate: Number(e.target.value) } : null)}
              />
              
              <Select
                label="Source"
                selectedKeys={[editingCurrency.source]}
                onChange={(e) => setEditingCurrency(prev => prev ? { ...prev, source: e.target.value as any } : null)}
              >
                <SelectItem key="manual">Manual</SelectItem>
                <SelectItem key="api">API</SelectItem>
                <SelectItem key="bank">Bank</SelectItem>
              </Select>
              
              <Select
                label="Update Frequency"
                selectedKeys={[editingCurrency.updateFrequency]}
                onChange={(e) => setEditingCurrency(prev => prev ? { ...prev, updateFrequency: e.target.value as any } : null)}
              >
                <SelectItem key="manual">Manual</SelectItem>
                <SelectItem key="daily">Daily</SelectItem>
                <SelectItem key="hourly">Hourly</SelectItem>
                <SelectItem key="realtime">Real-time</SelectItem>
              </Select>
            </CardBody>
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="light"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onClick={handleUpdateCurrency}
              >
                Update
              </Button>
            </CardFooter>
          </Card>
        </Card>
      )}
    </div>
  );
}
