'use client';

import React, { useState } from 'react';
import { Button, Input, Select, SelectItem } from '@heroui/react';
import { useSettingsStore } from '../../lib/settings/store';
import HeadingInfo from '../HeadingInfo';
import { useComplianceStore } from '../../lib/compliance/store';
import { formatMoney } from '../../lib/format/currency';

const SERVICE_TAX_CATEGORIES = [
  { key: 'SERVICE', label: 'Standard sales tax' },
  { key: 'FOOD', label: 'Food & beverage' },
  { key: 'EVENT', label: 'Event' },
  { key: 'HOTEL', label: 'Accommodation' },
] as const;
type ServiceTaxCategory = typeof SERVICE_TAX_CATEGORIES[number]['key'];

const SERVICE_UNITS = ['per_item', 'per_hour', 'per_day', 'per_person', 'per_order', 'per_session', 'per_trip', 'fixed'] as const;

function suggestedTaxCategory(charge: { name?: string; description?: string; category?: string; taxCategory?: string }): ServiceTaxCategory {
  const explicit = (charge.taxCategory || '').toUpperCase();
  if (explicit === 'FOOD' || explicit === 'EVENT' || explicit === 'HOTEL' || explicit === 'SERVICE') return explicit;
  if (explicit === 'ROOM') return 'HOTEL';
  const text = `${charge.name || ''} ${charge.description || ''} ${charge.category || ''}`.toLowerCase();
  if (/(restaurant|bar|room service|minibar|breakfast|lunch|dinner|snack|beverage|drink|food|meal)/.test(text)) return 'FOOD';
  if (text.includes('conference') || text.includes('event')) return 'EVENT';
  if (/\b(room|hotel|accommodation)\b/.test(text) && !text.includes('room service')) return 'HOTEL';
  return 'SERVICE';
}

function getUnitLabel(unit: string) {
  const unitLabels: Record<string, string> = {
    per_item: 'per item',
    per_hour: 'per hour',
    per_day: 'per day',
    per_person: 'per person',
    per_order: 'per order',
    per_session: 'per session',
    per_trip: 'per trip',
    fixed: 'fixed',
  };
  return unitLabels[unit] || unit;
}

type PricingRow = {
  id: string;
  isNew: boolean;
  name: string;
  category: string;
  unit: string;
  basePrice: string;
  maxDiscountPercent: string;
  taxCategory: ServiceTaxCategory;
};

function rowFromCharge(charge: {
  id: string;
  name: string;
  category: string;
  unit: string;
  basePrice: number;
  maxDiscountPercent: number;
  description?: string;
  taxCategory?: string;
}): PricingRow {
  return {
    id: charge.id,
    isNew: false,
    name: charge.name,
    category: charge.category,
    unit: charge.unit,
    basePrice: String(charge.basePrice),
    maxDiscountPercent: String(charge.maxDiscountPercent),
    taxCategory: suggestedTaxCategory(charge),
  };
}

export default function ServiceChargePricingPanel() {
  const serviceCharges = useSettingsStore((s) => s.roomManagement.serviceCharges);
  const canManagePricing = useSettingsStore((s) => s.hasPermission('settings.manage-rooms-pricing'));
  const calculateTax = useComplianceStore((s) => s.calculateTax);
  const [rows, setRows] = useState<PricingRow[]>(() => serviceCharges.map(rowFromCharge));
  const [savedNote, setSavedNote] = useState('');

  const addRow = () => {
    const id = `new-${Date.now()}`;
    setRows(prev => [...prev, {
      id,
      isNew: true,
      name: '',
      category: '',
      unit: 'per_item',
      basePrice: '',
      maxDiscountPercent: '0',
      taxCategory: 'SERVICE',
    }]);
    setTimeout(() => {
      document.getElementById(`pricing-${id}`)?.scrollIntoView({ block: 'center' });
    }, 50);
  };

  const saveRates = () => {
    const { updateServiceCharge, addServiceCharge, roomManagement } = useSettingsStore.getState();
    const catalog = roomManagement.serviceCharges;
    const used = new Set(catalog.map(charge => charge.id));
    for (const row of rows) {
      const basePrice = Math.max(0, Number(row.basePrice) || 0);
      const maxDiscountPercent = Math.min(100, Math.max(0, Number(row.maxDiscountPercent) || 0));
      if (row.isNew) {
        const name = row.name.trim();
        if (!name) continue;
        let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'service';
        let n = 2;
        const baseId = id;
        while (used.has(id)) id = `${baseId}-${n++}`;
        used.add(id);
        const unit = (SERVICE_UNITS as readonly string[]).includes(row.unit) ? row.unit : 'per_item';
        addServiceCharge({
          id,
          name,
          category: row.category.trim() || 'General',
          icon: '🧾',
          basePrice,
          isActive: true,
          description: name,
          requiresApproval: false,
          maxDiscountPercent,
          taxIncluded: true,
          unit: unit as typeof SERVICE_UNITS[number],
          seasonalPricing: [],
          taxCategory: row.taxCategory,
        });
        continue;
      }
      const current = catalog.find(charge => charge.id === row.id);
      if (!current) continue;
      const samePrice = basePrice === current.basePrice && maxDiscountPercent === current.maxDiscountPercent;
      const sameTax = row.taxCategory === (current.taxCategory || suggestedTaxCategory(current));
      if (samePrice && sameTax) continue;
      updateServiceCharge(row.id, { basePrice, maxDiscountPercent, taxCategory: row.taxCategory });
    }
    setRows(useSettingsStore.getState().roomManagement.serviceCharges.map(rowFromCharge));
    setSavedNote('Rates saved.');
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold text-ghana-black">Service rates</h2>
          <HeadingInfo label="About service rates">Rates are what the desk charges, before tax. Tax comes from Compliance. Staff can discount up to the maximum, and they cannot type a different rate.</HeadingInfo>
        </div>
        {canManagePricing && (
          <div className="flex gap-2">
            <Button size="sm" variant="flat" className="bg-secondary/20 text-secondary-600" onPress={addRow}>
              Add service
            </Button>
            <Button size="sm" className="bg-ghana-gold text-white" onPress={saveRates}>
              Save rates
            </Button>
          </div>
        )}
      </div>
      {savedNote ? <p className="text-sm text-green-700">{savedNote}</p> : null}
      {rows.map((row) => {
        const saved = serviceCharges.find(charge => charge.id === row.id);
        const rate = Number(row.basePrice) || 0;
        const preview = rate > 0
          ? calculateTax(rate, row.taxCategory, { domain: 'sales', operation: 'external' })
          : null;
        return (
          <div key={row.id} id={`pricing-${row.id}`} className="space-y-2 rounded-lg border border-gray-200 px-3 py-3">
            {row.isNew ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
                <Input
                  size="sm"
                  label="Service name"
                  value={row.name}
                  isReadOnly={!canManagePricing}
                  onChange={(e) => setRows(prev => prev.map(item => item.id === row.id ? { ...item, name: e.target.value } : item))}
                />
                <Input
                  size="sm"
                  label="Group"
                  placeholder="Recreation"
                  value={row.category}
                  isReadOnly={!canManagePricing}
                  onChange={(e) => setRows(prev => prev.map(item => item.id === row.id ? { ...item, category: e.target.value } : item))}
                />
                <Select
                  size="sm"
                  label="Unit"
                  selectedKeys={[row.unit]}
                  isDisabled={!canManagePricing}
                  onSelectionChange={(keys) => {
                    const unit = Array.from(keys)[0] as string | undefined;
                    if (!unit) return;
                    setRows(prev => prev.map(item => item.id === row.id ? { ...item, unit } : item));
                  }}
                >
                  {SERVICE_UNITS.map(unit => (
                    <SelectItem key={unit}>{getUnitLabel(unit)}</SelectItem>
                  ))}
                </Select>
                {canManagePricing && (
                  <Button size="sm" variant="light" className="self-end" onPress={() => setRows(prev => prev.filter(item => item.id !== row.id))}>
                    Remove
                  </Button>
                )}
              </div>
            ) : (
              <div className="min-w-0">
                <div className="truncate font-medium">{saved?.icon} {row.name}</div>
                <div className="text-xs text-gray-500">{row.category} · {getUnitLabel(row.unit)}</div>
              </div>
            )}
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[9rem_9rem_1fr_auto]">
              <Input
                size="sm"
                type="number"
                label="Rate excl. tax"
                value={row.basePrice}
                isReadOnly={!canManagePricing}
                onChange={(e) => setRows(prev => prev.map(item => item.id === row.id ? { ...item, basePrice: e.target.value } : item))}
              />
              <Input
                size="sm"
                type="number"
                label="Max discount %"
                value={row.maxDiscountPercent}
                isReadOnly={!canManagePricing}
                onChange={(e) => setRows(prev => prev.map(item => item.id === row.id ? { ...item, maxDiscountPercent: e.target.value } : item))}
              />
              <Select
                size="sm"
                label="Tax treatment"
                selectedKeys={[row.taxCategory]}
                isDisabled={!canManagePricing}
                onSelectionChange={(keys) => {
                  const taxCategory = Array.from(keys)[0] as ServiceTaxCategory | undefined;
                  if (!taxCategory) return;
                  setRows(prev => prev.map(item => item.id === row.id ? { ...item, taxCategory } : item));
                }}
              >
                {SERVICE_TAX_CATEGORIES.map(option => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <div className="pb-2 text-sm font-semibold whitespace-nowrap text-gray-900">
                {preview && preview.taxes.length > 0
                  ? `Guest pays ₵${formatMoney(preview.total)}`
                  : rate > 0
                    ? 'No sales tax'
                    : ''}
              </div>
            </div>
            {preview && preview.taxes.length > 0 ? (
              <div className="text-xs text-gray-600">
                {preview.taxes.map(tax => `${tax.name} ${tax.rate}% ₵${formatMoney(tax.amount)}`).join(' · ')}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
