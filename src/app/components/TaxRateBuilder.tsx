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
  Switch,
  Tooltip
} from "@heroui/react";
import { useComplianceStore } from '@/app/lib/compliance/store';
import { useCalculateTax } from '@/app/hooks/useCalculateTax';
import { TaxRule } from '@/app/lib/models';

interface TaxRuleForm {
  id: string;
  countryCode: string;
  name: string;
  typeId?: string;
  rate: number;
  glCode: string;
  appliesTo: string[];
  description?: string;
  isActive: boolean;
  priority?: number;
  calculationBase?: 'subtotal' | 'subtotal_plus_applied' | 'per_person' | 'per_night' | 'per_person_night';
  method?: 'rate' | 'fixed' | 'tiered';
  fixedAmount?: number;
  tiers?: Array<{ upto?: number; rate?: number; fixed?: number }>;
  stacking?: 'additive' | 'compound';
  rounding?: 'none' | 'nearest' | 'down' | 'up';
  roundTo?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  tags?: string[];
  domain?: 'sales' | 'payroll' | 'corporate' | 'custom';
  operation?: 'internal' | 'external' | 'both';
  effect?: 'add' | 'subtract' | 'exclude_total' | 'informational';
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
  const { isOpen: isTypeOpen, onOpen: onOpenType, onClose: onCloseType } = useDisclosure();
  const { isOpen: isAssignOpen, onOpen: onOpenAssign, onClose: onCloseAssign } = useDisclosure();
  const { taxRules, taxTypes, setCountry } = useComplianceStore();
  const calcTax = useCalculateTax();
  const [selectedCountry, setSelectedCountry] = useState('GH');
  const [filterOperation, setFilterOperation] = useState<'internal' | 'external' | 'both'>('both');
  const [filterDomain, setFilterDomain] = useState<'sales' | 'purchases' | 'payroll' | 'corporate' | 'custom'>('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [sim, setSim] = useState({ amount: 1000, category: 'HOTEL', domain: 'sales', operation: 'external', numPersons: 1, numNights: 1, roomType: '', industry: '' });
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [autoAppliedCountries, setAutoAppliedCountries] = useState<Set<string>>(new Set());
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState('');
  const [isEditingType, setIsEditingType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<{ countryCode: string; name: string; description: string; domain: 'sales'|'purchases'|'payroll'|'corporate'|'custom'; operation: 'internal'|'external'|'both' }>({ countryCode: 'GH', name: '', description: '', domain: 'sales', operation: 'both' });

  useEffect(() => {
    setTypeForm(prev => ({ ...prev, countryCode: selectedCountry }));
  }, [selectedCountry]);

  const availableTypes = React.useMemo(() => (
    (taxTypes || []).filter(t => t.countryCode === selectedCountry)
  ), [taxTypes, selectedCountry]);

  const [assignSelection, setAssignSelection] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');

  const handleSaveTaxType = async () => {
    const name = (typeForm.name || '').trim();
    if (!name) { try { alert('Tax type name is required.'); } catch {} return; }
    try {
      const res = await fetch('/api/compliance/tax-types/manage', {
        method: editingTypeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTypeId || undefined,
          countryCode: selectedCountry,
          name: name,
          description: (typeForm.description || '').trim(),
          domain: typeForm.domain,
          operation: typeForm.operation
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create tax type');
      }
      const saved = await res.json();
      await setCountry(selectedCountry);
      // Preselect the newly created type for convenience
      setFormData(prev => ({
        ...prev,
        typeId: saved?.id || prev.typeId,
        name: saved?.name || prev.name,
        domain: saved?.domain || prev.domain,
        operation: saved?.operation || prev.operation
      }));
      setTypeForm({ countryCode: selectedCountry, name: '', description: '', domain: 'sales', operation: 'both' });
      setIsEditingType(false);
      setEditingTypeId(null);
      onCloseType();
    } catch (e: any) {
      console.error('Create tax type failed', e);
      try { alert(e?.message || 'Failed to create tax type'); } catch {}
    }
  };

  const templateMeta: Record<string, { title: string; domain: 'sales'|'purchases'|'payroll'|'corporate'; operation: 'internal'|'external'; effect: 'all'|'add'|'subtract'|'exclude_total'|'informational' }> = {
    ghana_sales_standard: { title: 'Ghana Sales (VAT+Levies)', domain: 'sales', operation: 'external', effect: 'all' },
    withholding_services: { title: 'Withholding - Services', domain: 'sales', operation: 'external', effect: 'subtract' },
    purchases_vat: { title: 'Purchases VAT', domain: 'purchases', operation: 'external', effect: 'add' },
    payroll_paye: { title: 'PAYE Placeholder', domain: 'payroll', operation: 'internal', effect: 'subtract' },
    us_sales_generic: { title: 'US Sales (State/Local/Occupancy)', domain: 'sales', operation: 'external', effect: 'all' },
    us_purchases_tax: { title: 'US Purchases Tax (Placeholder)', domain: 'purchases', operation: 'external', effect: 'add' },
    us_payroll_income: { title: 'US Payroll Income (Placeholder)', domain: 'payroll', operation: 'internal', effect: 'subtract' },
    nigeria_vat_standard: { title: 'Nigeria VAT (7.5%)', domain: 'sales', operation: 'external', effect: 'add' },
    nigeria_purchases_vat: { title: 'Nigeria Purchases VAT (7.5%)', domain: 'purchases', operation: 'external', effect: 'add' },
    nigeria_payroll_paye: { title: 'Nigeria PAYE (Placeholder)', domain: 'payroll', operation: 'internal', effect: 'subtract' },
    south_africa_vat_standard: { title: 'South Africa VAT (15%)', domain: 'sales', operation: 'external', effect: 'add' },
    south_africa_purchases_vat: { title: 'South Africa Purchases VAT (15%)', domain: 'purchases', operation: 'external', effect: 'add' },
    south_africa_payroll_paye: { title: 'South Africa PAYE (Placeholder)', domain: 'payroll', operation: 'internal', effect: 'subtract' },
    kenya_vat_standard: { title: 'Kenya VAT (16%)', domain: 'sales', operation: 'external', effect: 'add' },
    kenya_purchases_vat: { title: 'Kenya Purchases VAT (16%)', domain: 'purchases', operation: 'external', effect: 'add' },
    kenya_payroll_paye: { title: 'Kenya PAYE (Placeholder)', domain: 'payroll', operation: 'internal', effect: 'subtract' },
    zimbabwe_vat_standard: { title: 'Zimbabwe VAT (15%)', domain: 'sales', operation: 'external', effect: 'add' },
    zimbabwe_purchases_vat: { title: 'Zimbabwe Purchases VAT (15%)', domain: 'purchases', operation: 'external', effect: 'add' },
    zimbabwe_payroll_paye: { title: 'Zimbabwe PAYE (Placeholder)', domain: 'payroll', operation: 'internal', effect: 'subtract' }
  };

  const getTemplateCount = (key: string): number => {
    const meta = templateMeta[key];
    if (!meta) return 0;
    return taxRules
      .filter(r => r.countryCode === selectedCountry)
      .filter(r => ((r as any).domain || 'sales') === meta.domain)
      .filter(r => {
        const op = ((r as any).operation || 'both');
        return op === 'both' || op === meta.operation;
      })
      .filter(r => meta.effect === 'all' ? true : ((r as any).effect || 'add') === meta.effect)
      .filter((r, idx, arr) => arr.findIndex(x => x.id === r.id) === idx)
      .length;
  };

  const viewTemplate = (templateKey: string) => {
    const meta = templateMeta[templateKey];
    if (!meta) return;
    setFilterDomain(meta.domain);
    setFilterOperation(meta.operation);
    setSearchTerm('');
    try { document?.getElementById('rules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
  };

  const getVisibleTemplateKeys = (): string[] => {
    const base = Object.keys(templateMeta).filter((k) => {
      const t = templateMeta[k];
      const domainOk = t.domain === filterDomain;
      const opOk = filterOperation === 'both' ? true : t.operation === filterOperation;
      return domainOk && opOk;
    });
    const defaults = getDefaultTemplatesForCountry(selectedCountry);
    const preferred = defaults.filter(k => base.includes(k));
    return preferred.length ? preferred : defaults; // fallback: show all country templates so the section is never empty
  };

  const getTemplateRulesForKey = (key: string) => {
    const meta = templateMeta[key];
    if (!meta) return [] as any[];
    return taxRules
      .filter(r => r.countryCode === selectedCountry)
      .filter(r => ((r as any).domain || 'sales') === meta.domain)
      .filter(r => { const op = ((r as any).operation || 'both'); return op === 'both' || op === meta.operation; })
      .filter(r => meta.effect === 'all' ? true : ((r as any).effect || 'add') === meta.effect)
      .filter((r, idx, arr) => arr.findIndex(x => x.id === r.id) === idx);
  };

  const getDefaultTemplatesForCountry = (code: string): string[] => {
    switch (code) {
      case 'GH':
        return ['ghana_sales_standard'];
      case 'US':
        return ['us_sales_generic', 'us_purchases_tax', 'us_payroll_income'];
      case 'NG':
        return ['nigeria_vat_standard', 'nigeria_purchases_vat', 'nigeria_payroll_paye'];
      case 'ZA':
        return ['south_africa_vat_standard', 'south_africa_purchases_vat', 'south_africa_payroll_paye'];
      case 'KE':
        return ['kenya_vat_standard', 'kenya_purchases_vat', 'kenya_payroll_paye'];
      case 'ZW':
        return ['zimbabwe_vat_standard', 'zimbabwe_purchases_vat', 'zimbabwe_payroll_paye'];
      default:
        return [];
    }
  };

  const ghanaSpecificNames = new Set(['NHIL','GETFund Levy','COVID-19 Levy','VAT (Standard Rate)','Tourism Levy','Withholding - Services']);
  const hasMismatchedGhanaRules = selectedCountry !== 'GH' && taxRules.some(r => r.countryCode === selectedCountry && ghanaSpecificNames.has(r.name));

  const resetCountryToDefaults = async () => {
    const flag = countries.find(c => c.code === selectedCountry)?.flag || '🌍';
    const ok = typeof window !== 'undefined' ? window.confirm(`Reset rules for ${flag} ${selectedCountry} to defaults? This will delete all existing rules for this country.`) : true;
    if (!ok) return;
    // Delete all rules for the selected country
    const rulesForCountry = taxRules.filter(r => r.countryCode === selectedCountry);
    for (const r of rulesForCountry) {
      try { await fetch(`/api/compliance/taxes/manage?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' }); } catch {}
    }
    await setCountry(selectedCountry);
    // Apply defaults for country
    const keys = getDefaultTemplatesForCountry(selectedCountry);
    for (const k of keys) {
      await applyTemplate(k, { silent: true, skipFilterSync: true });
    }
    setFilterDomain('sales');
    setFilterOperation('external');
    setFilterEffect('all');
    try { alert(`Reset complete for ${selectedCountry}.`); } catch {}
  };

  React.useEffect(() => {
    const code = selectedCountry;
    const already = autoAppliedCountries.has(code);
    const count = taxRules.filter(r => r.countryCode === code).length;
    if (count === 0 && !already) {
      const keys = getDefaultTemplatesForCountry(code);
      if (keys.length) {
        (async () => {
          for (const k of keys) {
            await applyTemplate(k, { silent: true, skipFilterSync: true });
          }
          setAutoAppliedCountries(prev => new Set([...Array.from(prev), code]));
          try { alert(`Default tax types applied for ${code}.`); } catch {}
        })();
      }
    }
  }, [selectedCountry, taxRules]);
  const [editingRule, setEditingRule] = useState<TaxRule | TaxRuleForm | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<TaxRuleForm>({
    id: '',
    countryCode: 'GH',
    name: '',
    typeId: '',
    rate: 0,
    glCode: '',
    appliesTo: ['ALL'],
    description: '',
    isActive: true,
    priority: 100,
    calculationBase: 'subtotal',
    method: 'rate',
    fixedAmount: 0,
    tiers: [],
    stacking: 'additive',
    rounding: 'none',
    roundTo: 0.01,
    domain: 'sales',
    operation: 'both'
  });

  useEffect(() => {
    setCountry(selectedCountry);
  }, [selectedCountry, setCountry]);

  useEffect(() => {
    if (!selectedTypeId) return;
    const t: any = (taxTypes || []).find(x => x.id === selectedTypeId);
    if (t) {
      setSim(prev => ({ ...prev, domain: t.domain || prev.domain, operation: t.operation || prev.operation }));
      try {
        if (t.domain) setFilterDomain(t.domain as any);
        if (t.operation) setFilterOperation(t.operation as any);
      } catch {}
    }
  }, [selectedTypeId, taxTypes]);

  const openAssignRulesModal = (typeId: string) => {
    setSelectedTypeId(String(typeId));
    const current = new Set(
      taxRules
        .filter(r => r.countryCode === selectedCountry)
        .filter(r => String((r as any).typeId || '') === String(typeId))
        .map(r => String(r.id))
    );
    setAssignSelection(current);
    setAssignSearch('');
    onOpenAssign();
  };

  const saveAssignedRules = async () => {
    const typeId = selectedTypeId;
    if (!typeId) { onCloseAssign(); return; }
    const all = taxRules.filter(r => r.countryCode === selectedCountry);
    const selectedIds = Array.from(assignSelection);
    const selectedSet = new Set(selectedIds.map(String));
    for (const r of all) {
      const isSelected = selectedSet.has(String(r.id));
      const currently = String((r as any).typeId || '') === String(typeId);
      if (isSelected && !currently) {
        try {
          await fetch('/api/compliance/taxes/manage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...r, typeId })
          });
        } catch {}
      }
      if (!isSelected && currently) {
        try {
          await fetch('/api/compliance/taxes/manage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...r, typeId: '' })
          });
        } catch {}
      }
    }
    await setCountry(selectedCountry);
    onCloseAssign();
  };

  const handleOpenModal = (rule?: TaxRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        id: rule.id,
        countryCode: rule.countryCode,
        name: rule.name,
        typeId: (rule as any).typeId || '',
        rate: rule.rate,
        glCode: rule.glCode,
        appliesTo: rule.appliesTo || ['ALL'],
        description: rule.description || '',
        isActive: rule.enabled !== false,
        priority: rule.priority ?? 100,
        calculationBase: rule.calculationBase || 'subtotal',
        method: (rule as any).method || 'rate',
        fixedAmount: (rule as any).fixedAmount ?? 0,
        tiers: (rule as any).tiers || [],
        stacking: rule.stacking || 'additive',
        rounding: rule.rounding || 'none',
        roundTo: rule.roundTo ?? 0.01,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        domain: (rule as any).domain || 'sales',
        operation: (rule as any).operation || 'both',
        effect: (rule as any).effect || 'add',
        tags: rule.tags || []
      });
      setIsEditMode(true);
    } else {
      setEditingRule(null);
      setFormData({
        id: '',
        countryCode: selectedCountry,
        name: '',
        typeId: selectedTypeId || '',
        rate: 0,
        glCode: '',
        appliesTo: ['ALL'],
        description: '',
        isActive: true,
        priority: 100,
        calculationBase: 'subtotal',
        method: 'rate',
        fixedAmount: 0,
        tiers: [],
        stacking: 'additive',
        rounding: 'none',
        roundTo: 0.01,
        domain: 'sales',
        operation: 'both'
      });
      setIsEditMode(false);
    }
    onOpen();
  };

  const handleSave = async () => {
    try {
      const ruleData = {
        id: formData.id || undefined,
        countryCode: selectedCountry,
        name: formData.name,
        typeId: formData.typeId || undefined,
        rate: formData.rate,
        glCode: formData.glCode,
        appliesTo: formData.appliesTo,
        description: formData.description,
        enabled: formData.isActive,
        priority: formData.priority,
        calculationBase: formData.calculationBase,
        method: formData.method,
        fixedAmount: formData.fixedAmount,
        tiers: formData.tiers,
        stacking: formData.stacking,
        rounding: formData.rounding,
        roundTo: formData.roundTo,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo,
        domain: formData.domain,
        operation: formData.operation,
        effect: formData.effect,
        tags: formData.tags
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

  const bulkSetEnabled = async (enabled: boolean) => {
    const ids = Array.from(selectedRuleIds);
    for (const id of ids) {
      const rule = taxRules.find(r => r.id === id);
      if (!rule) continue;
      try {
        await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rule, enabled })
        });
      } catch {}
    }
    await setCountry(selectedCountry);
    setSelectedRuleIds(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedRuleIds);
    for (const id of ids) {
      try { await fetch(`/api/compliance/taxes/manage?id=${id}`, { method: 'DELETE' }); } catch {}
    }
    await setCountry(selectedCountry);
    setSelectedRuleIds(new Set());
  };

  const getCountrySortedRules = () => {
    return taxRules
      .filter(r => r.countryCode === selectedCountry)
      .filter((r, idx, arr) => arr.findIndex(x => x.id === r.id) === idx)
      .sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
  };

  const reorderRule = async (ruleId: string, dir: 'up' | 'down') => {
    const list = getCountrySortedRules();
    const idx = list.findIndex(r => r.id === ruleId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const newOrder = [...list];
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    // Reassign sequential priorities (10,20,30...)
    const updates = newOrder.map((r, i) => ({ id: r.id, priority: (i + 1) * 10 }));
    for (const u of updates) {
      try {
        const base = taxRules.find(tr => tr.id === u.id);
        if (!base) continue;
        await fetch('/api/compliance/taxes/manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, priority: u.priority })
        });
      } catch {}
    }
    await setCountry(selectedCountry);
  };

  // Template builder
  const buildTemplateRules = (templateKey: string) => {
    const cc = selectedCountry;
    switch (templateKey) {
      case 'ghana_sales_standard':
        return [
          { countryCode: cc, name: 'NHIL', rate: 2.5, glCode: '2150', appliesTo: ['ALL'], description: 'National Health Insurance Levy', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'GETFund Levy', rate: 2.5, glCode: '2151', appliesTo: ['ALL'], description: 'Ghana Education Trust Fund Levy', enabled: true, priority: 11, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'COVID-19 Levy', rate: 1.0, glCode: '2152', appliesTo: ['ALL'], description: 'COVID-19 Recovery Levy', enabled: true, priority: 12, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'VAT (Standard Rate)', rate: 15.0, glCode: '2153', appliesTo: ['ALL'], description: 'VAT on (subtotal + levies)', enabled: true, priority: 20, calculationBase: 'subtotal_plus_applied', method: 'rate', stacking: 'compound', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'Tourism Levy', rate: 1.0, glCode: '2154', appliesTo: ['ROOM','HOTEL'], description: 'Tourism development levy', enabled: true, priority: 30, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add', isSeparate: true },
        ];
      case 'withholding_services':
        return [
          { countryCode: cc, name: 'Withholding - Services', rate: 7.5, glCode: '2300', appliesTo: ['SERVICE'], description: 'Service withholding tax', enabled: true, priority: 5, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'subtract' },
        ];
      case 'purchases_vat':
        return [
          { countryCode: cc, name: 'Purchases VAT', rate: 15.0, glCode: '2400', appliesTo: ['ALL'], description: 'Input VAT on purchases', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'payroll_paye':
        return [
          { countryCode: cc, name: 'PAYE', rate: 0, glCode: 'PAYE', appliesTo: ['ALL'], description: 'Pay As You Earn (handled in payroll)', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      case 'us_sales_generic':
        return [
          { countryCode: cc, name: 'State Sales Tax', rate: 6.0, glCode: '3100', appliesTo: ['ALL'], description: 'State-level sales tax (placeholder)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'Local Sales Tax', rate: 2.0, glCode: '3110', appliesTo: ['ALL'], description: 'Local/city sales tax (placeholder)', enabled: true, priority: 11, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
          { countryCode: cc, name: 'Hotel Occupancy Tax', rate: 5.0, glCode: '3120', appliesTo: ['HOTEL','ROOM'], description: 'Occupancy/bed tax (placeholder)', enabled: true, priority: 30, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add', isSeparate: true },
        ];
      case 'nigeria_vat_standard':
        return [
          { countryCode: cc, name: 'VAT (Standard Rate)', rate: 7.5, glCode: '2500', appliesTo: ['ALL'], description: 'Nigeria VAT 7.5%', enabled: true, priority: 20, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
        ];
      case 'south_africa_vat_standard':
        return [
          { countryCode: cc, name: 'VAT (Standard Rate)', rate: 15.0, glCode: '2600', appliesTo: ['ALL'], description: 'South Africa VAT 15%', enabled: true, priority: 20, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
        ];
      case 'kenya_vat_standard':
        return [
          { countryCode: cc, name: 'VAT (Standard Rate)', rate: 16.0, glCode: '2700', appliesTo: ['ALL'], description: 'Kenya VAT 16%', enabled: true, priority: 20, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
        ];
      case 'zimbabwe_vat_standard':
        return [
          { countryCode: cc, name: 'VAT (Standard Rate)', rate: 15.0, glCode: '2800', appliesTo: ['ALL'], description: 'Zimbabwe VAT 15%', enabled: true, priority: 20, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'sales', operation: 'external', effect: 'add' },
        ];
      case 'us_purchases_tax':
        return [
          { countryCode: cc, name: 'Purchases Tax', rate: 6.0, glCode: '3410', appliesTo: ['ALL'], description: 'US purchases tax placeholder (state-varies)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'us_payroll_income':
        return [
          { countryCode: cc, name: 'Income Tax (Payroll)', rate: 0, glCode: 'PR-US', appliesTo: ['ALL'], description: 'US payroll income placeholder (configure brackets in payroll)', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      case 'nigeria_purchases_vat':
        return [
          { countryCode: cc, name: 'Purchases VAT', rate: 7.5, glCode: '2510', appliesTo: ['ALL'], description: 'Input VAT on purchases (Nigeria)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'nigeria_payroll_paye':
        return [
          { countryCode: cc, name: 'PAYE', rate: 0, glCode: 'PR-NG', appliesTo: ['ALL'], description: 'Nigeria PAYE placeholder', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      case 'south_africa_purchases_vat':
        return [
          { countryCode: cc, name: 'Purchases VAT', rate: 15.0, glCode: '2610', appliesTo: ['ALL'], description: 'Input VAT on purchases (South Africa)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'south_africa_payroll_paye':
        return [
          { countryCode: cc, name: 'PAYE', rate: 0, glCode: 'PR-ZA', appliesTo: ['ALL'], description: 'South Africa PAYE placeholder', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      case 'kenya_purchases_vat':
        return [
          { countryCode: cc, name: 'Purchases VAT', rate: 16.0, glCode: '2710', appliesTo: ['ALL'], description: 'Input VAT on purchases (Kenya)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'kenya_payroll_paye':
        return [
          { countryCode: cc, name: 'PAYE', rate: 0, glCode: 'PR-KE', appliesTo: ['ALL'], description: 'Kenya PAYE placeholder', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      case 'zimbabwe_purchases_vat':
        return [
          { countryCode: cc, name: 'Purchases VAT', rate: 15.0, glCode: '2810', appliesTo: ['ALL'], description: 'Input VAT on purchases (Zimbabwe)', enabled: true, priority: 10, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'purchases', operation: 'external', effect: 'add' },
        ];
      case 'zimbabwe_payroll_paye':
        return [
          { countryCode: cc, name: 'PAYE', rate: 0, glCode: 'PR-ZW', appliesTo: ['ALL'], description: 'Zimbabwe PAYE placeholder', enabled: true, priority: 100, calculationBase: 'subtotal', method: 'rate', stacking: 'additive', rounding: 'nearest', roundTo: 0.01, domain: 'payroll', operation: 'internal', effect: 'subtract' },
        ];
      default:
        return [];
    }
  };

  const applyTemplate = async (templateKey: string, options?: { silent?: boolean; skipFilterSync?: boolean; forceTypeId?: string }) => {
    if (isApplyingTemplate) return;
    setIsApplyingTemplate(true);
    const rules = buildTemplateRules(templateKey);
    if (rules.length === 0) return;
    // Ensure a Tax Type exists for this template
    const meta = templateMeta[templateKey];
    const typeName = meta?.title || templateKey;
    let typeIdForTemplate: string | null = options?.forceTypeId || null;
    try {
      if (!typeIdForTemplate) {
        const existing = (taxTypes || []).find(t => t.countryCode === selectedCountry && t.name === typeName);
        if (existing) {
          typeIdForTemplate = String((existing as any).id);
        } else {
          const typeRes = await fetch('/api/compliance/tax-types/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode: selectedCountry, name: typeName, description: `Auto-created from template ${templateKey}`, domain: meta?.domain, operation: meta?.operation, tags: [`template:${templateKey}`] })
          });
          if (typeRes.ok) {
            const created = await typeRes.json();
            typeIdForTemplate = String(created?.id);
          }
        }
      }
    } catch {}
    // Build a lookup of existing rules by country+name
    const existingByKey: Record<string, any> = {};
    taxRules
      .filter(r => r.countryCode === selectedCountry)
      .forEach(r => { existingByKey[`${String(r.countryCode)}:${String(r.name)}`] = r; });
    for (const rule of rules) {
      try {
        const key = `${String(rule.countryCode)}:${String(rule.name)}`;
        const found = existingByKey[key];
        const payload = found ? { ...found, ...rule, id: found.id, typeId: typeIdForTemplate || (found as any).typeId } : { ...rule, typeId: typeIdForTemplate || undefined };
        await fetch('/api/compliance/taxes/manage', {
          method: found ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }
    await setCountry(selectedCountry);
    // Set filters to relevant context after apply (generic via templateMeta)
    if (!options?.skipFilterSync) {
      if (meta) {
        setFilterDomain(meta.domain);
        setFilterOperation(meta.operation);
      }
    }
    if (typeIdForTemplate) setSelectedTypeId(typeIdForTemplate);
    if (!options?.silent) {
      try { alert('Tax type applied successfully.'); } catch {}
    }
    setIsApplyingTemplate(false);
  };

  const getCountryFlag = (code: string) => {
    const country = countries.find(c => c.code === code);
    return country?.flag || '🌍';
  };

  const getTemplateKeyForType = (type: any): string | null => {
    // Prefer explicit tag: template:<key>
    const tag = (type?.tags || []).find((t: string) => typeof t === 'string' && t.startsWith('template:'));
    if (tag) return tag.split(':')[1];
    // Fallback: match by title/name
    for (const key of Object.keys(templateMeta)) {
      if ((templateMeta as any)[key]?.title === type?.name) return key;
    }
    return null;
  };

  const buildRuleKey = (r: any): string => {
    const name = (r?.name || '').toLowerCase();
    const gl = (r?.glCode || '').toLowerCase();
    const domain = (r?.domain || 'sales').toLowerCase();
    const op = (r?.operation || 'both').toLowerCase();
    const base = (r?.calculationBase || 'subtotal').toLowerCase();
    const method = (r?.method || 'rate').toLowerCase();
    const applies = Array.isArray(r?.appliesTo) ? [...r.appliesTo].sort().join(',').toLowerCase() : 'all';
    return `${name}|${gl}|${domain}|${op}|${base}|${method}|${applies}`;
  };

  const getFilteredRulesForDedup = (): any[] => {
    return taxRules
      .filter(rule => rule.countryCode === selectedCountry)
      .filter(rule => (selectedTypeId ? String((rule as any).typeId || '') === String(selectedTypeId) : true))
      .filter(rule => (filterOperation === 'both' ? true : ((rule as any).operation || 'both') === filterOperation))
      .filter(rule => ((rule as any).domain || 'sales') === filterDomain)
      .filter(rule => {
        if (!searchTerm?.trim()) return true;
        const q = searchTerm.toLowerCase();
        return rule.name.toLowerCase().includes(q) || (rule.glCode || '').toLowerCase().includes(q);
      });
  };

  const duplicatesCount = React.useMemo(() => {
    const list = getFilteredRulesForDedup();
    const seen = new Set<string>();
    let dup = 0;
    for (const r of list) {
      const key = buildRuleKey(r);
      if (seen.has(key)) dup += 1; else seen.add(key);
    }
    return dup;
  }, [taxRules, selectedCountry, selectedTypeId, filterOperation, filterDomain, searchTerm]);

  const removeDuplicates = async () => {
    const list = getFilteredRulesForDedup().sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
    const keepByKey: Record<string, string> = {};
    const toDelete: string[] = [];
    for (const r of list) {
      const key = buildRuleKey(r);
      if (!keepByKey[key]) keepByKey[key] = String(r.id); else toDelete.push(String(r.id));
    }
    for (const id of toDelete) {
      try { await fetch(`/api/compliance/taxes/manage?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
    }
    await setCountry(selectedCountry);
  };

  const restoreGhanaCoreRules = async () => {
    if (selectedCountry !== 'GH') return;
    const typeId = selectedTypeId || '';
    const desired = [
      { name: 'GETFund Levy', rate: 2.5, glCode: '2151', priority: 11, base: 'subtotal' as const },
      { name: 'Tourism Levy', rate: 1.0, glCode: '2154', priority: 30, base: 'subtotal' as const },
      { name: 'Flat Rate', rate: 3.0, glCode: '2155', priority: 40, base: 'subtotal' as const },
    ];
    for (const d of desired) {
      const existing = taxRules.find(r => r.countryCode === 'GH' && r.name === d.name);
      const payload: any = {
        id: existing?.id,
        countryCode: 'GH',
        name: d.name,
        typeId: typeId || existing && (existing as any).typeId,
        rate: d.rate,
        glCode: d.glCode,
        appliesTo: existing?.appliesTo || ['ALL'],
        description: existing?.description || d.name,
        enabled: true,
        priority: existing?.priority ?? d.priority,
        calculationBase: existing?.calculationBase || d.base,
        method: (existing as any)?.method || 'rate',
        stacking: existing?.stacking || 'additive',
        rounding: existing?.rounding || 'nearest',
        roundTo: existing?.roundTo ?? 0.01,
        domain: (existing as any)?.domain || 'sales',
        operation: (existing as any)?.operation || 'external',
        effect: (existing as any)?.effect || 'add',
      };
      try {
        await fetch('/api/compliance/taxes/manage', {
          method: existing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch {}
    }
    await setCountry(selectedCountry);
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
        <div className="flex gap-2">
          <Button 
            variant="bordered"
            onPress={onOpenType}
          >
            + Create Tax Type
          </Button>
        <Button 
          className="bg-ghana-green text-white"
          onPress={() => handleOpenModal()}
        >
          + Add Tax Rule
        </Button>
        </div>
      </div>

      {/* Context Filters: Operation + Domain */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">Operation
                <Tooltip content="Cost Centre (purchases, payroll, internal spend). Revenue Centre (sales, customer invoices, guest folios). Both applies in either context.">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                </Tooltip>
              </span>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={filterOperation === 'internal' ? 'solid' : 'flat'} className={filterOperation === 'internal' ? 'bg-ghana-green text-white' : ''} onPress={() => setFilterOperation('internal')}>Cost Centre</Button>
                <Button size="sm" variant={filterOperation === 'external' ? 'solid' : 'flat'} className={filterOperation === 'external' ? 'bg-ghana-green text-white' : ''} onPress={() => setFilterOperation('external')}>Revenue Centre</Button>
                <Button size="sm" variant={filterOperation === 'both' ? 'solid' : 'flat'} className={filterOperation === 'both' ? 'bg-ghana-green text-white' : ''} onPress={() => setFilterOperation('both')}>Both</Button>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">Domain
                <Tooltip content="Business area where the rule applies (Sales/Revenue, Purchases/Procurement, Payroll, Corporate, or Custom). Centre (Cost vs Revenue) is chosen separately.">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                </Tooltip>
              </span>
              <Select
                className="mt-2"
                selectedKeys={[filterDomain]}
                onSelectionChange={(keys) => setFilterDomain(Array.from(keys)[0] as any)}
                variant="bordered"
              >
                <SelectItem key="sales">Sales</SelectItem>
                <SelectItem key="purchases">Purchases</SelectItem>
                <SelectItem key="payroll">Payroll</SelectItem>
                <SelectItem key="corporate">Corporate</SelectItem>
                <SelectItem key="custom">Custom</SelectItem>
              </Select>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Country</span>
            <Select
                className="mt-2 w-48"
              selectedKeys={[selectedCountry]}
              onSelectionChange={(keys) => {
                const selectedKey = Array.from(keys)[0] as string;
                setSelectedCountry(selectedKey);
                setCountry(selectedKey);
              }}
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
            <div>
              <span className="text-sm font-medium text-gray-700">Search</span>
              <Input className="mt-2" placeholder="Search name / GL code" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} variant="bordered" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="flat" onPress={() => bulkSetEnabled(true)} isDisabled={selectedRuleIds.size === 0}>Enable</Button>
            <Button size="sm" variant="flat" onPress={() => bulkSetEnabled(false)} isDisabled={selectedRuleIds.size === 0}>Disable</Button>
            <Button size="sm" color="danger" variant="flat" onPress={bulkDelete} isDisabled={selectedRuleIds.size === 0}>Delete</Button>
            <span className="text-sm text-gray-600">Selected: {selectedRuleIds.size}</span>
            </div>
          </CardBody>
        </Card>

      

      {/* Tax Types Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">Tax Types</h3>
              <Chip size="sm" variant="flat">{(taxTypes || []).filter(t => t.countryCode === selectedCountry).length}</Chip>
            </div>
            <div className="flex items-center gap-2">
              <Input className="w-64" placeholder="Search tax types" value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)} variant="bordered" />
              <Button size="sm" variant="bordered" onPress={() => { setIsEditingType(false); setEditingTypeId(null); setTypeForm({ countryCode: selectedCountry, name: '', description: '', domain: 'sales', operation: 'both' }); onOpenType(); }}>+ Create Tax Type</Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(taxTypes || [])
              .filter(t => t.countryCode === selectedCountry)
              .filter(t => !typeSearch.trim() ? true : (t.name.toLowerCase().includes(typeSearch.toLowerCase()) || (t.description || '').toLowerCase().includes(typeSearch.toLowerCase())))
              .filter(t => {
                const domainOk = filterDomain ? ((t as any).domain || 'sales') === filterDomain || (t as any).domain === 'custom' : true;
                const op = (t as any).operation || 'both';
                const opOk = filterOperation === 'both' ? true : op === filterOperation || op === 'both';
                return domainOk && opOk;
              })
              .map((t) => {
                const count = taxRules.filter(r => r.countryCode === selectedCountry && (r as any).typeId === t.id).length;
                const selected = selectedTypeId === t.id;
              return (
                  <Card key={t.id} className={`border ${selected ? 'border-ghana-green' : 'border-default-200'}`}>
                    <CardBody>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setSelectedTypeId(String(t.id))}>
                          <div className="flex items-center gap-2">
                            <button className={`text-left ${selected ? 'text-ghana-green font-semibold' : 'font-medium'}`} onClick={() => setSelectedTypeId(t.id)}>
                              {t.name}
                            </button>
                            <Chip size="sm" variant="flat">{count} rules</Chip>
                    </div>
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="mr-2">Domain: {(t as any).domain || 'sales'}</span>
                            <span>Operation: {(t as any).operation || 'both'}</span>
                      </div>
                          {t.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</div>
                                  )}
                                </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="bg-ghana-green text-white" onPress={() => openAssignRulesModal(String(t.id))}>Add Rules</Button>
                          <Button size="sm" variant="flat" onPress={async () => {
                            const key = getTemplateKeyForType(t);
                            if (!key) { try { alert('No default rule template linked to this tax type.'); } catch {} return; }
                            await applyTemplate(key, { forceTypeId: String(t.id) });
                            setSelectedTypeId(String(t.id));
                          }}>Apply Rules</Button>
                          <Button size="sm" variant="bordered" onPress={() => { setIsEditingType(true); setEditingTypeId(String(t.id)); setTypeForm({ countryCode: selectedCountry, name: t.name, description: t.description || '', domain: (t as any).domain || 'sales', operation: (t as any).operation || 'both' }); onOpenType(); }}>Edit</Button>
                          <Button size="sm" color="danger" variant="bordered" onPress={async () => {
                            const ok = typeof window !== 'undefined' ? window.confirm(`Delete tax type "${t.name}"? This will not delete rules.`) : true;
                            if (!ok) return;
                            try {
                              await fetch(`/api/compliance/tax-types/manage?id=${encodeURIComponent(String(t.id))}`, { method: 'DELETE' });
                              await setCountry(selectedCountry);
                              if (selectedTypeId === t.id) setSelectedTypeId(null);
                            } catch {}
                          }}>Delete</Button>
                              </div>
                        </div>
                    </CardBody>
                  </Card>
              );
              })}
          </div>
        </CardBody>
      </Card>

      {/* Removed: Apply common tax types card */}

      {/* Tax Rules Table */}
      <Card className="mt-6" id="rules-section">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <div className="text-lg font-semibold">
                {selectedTypeId ? (
                  <>Rules for {countries.find(c => c.code === selectedCountry)?.flag || '🌍'} {selectedCountry} • {(taxTypes || []).find(t => t.id === selectedTypeId)?.name || 'Selected Type'}</>
                ) : (
                  <>Tax Rules for {countries.find(c => c.code === selectedCountry)?.flag || '🌍'} {selectedCountry}</>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {selectedTypeId ? (
                  <>
                    {taxRules.filter(rule => rule.countryCode === selectedCountry && (rule as any).typeId === selectedTypeId).length} rules
                  </>
                ) : (
                  <>
                    {taxRules.filter(rule => rule.countryCode === selectedCountry).length} rules
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="flat" onPress={() => handleOpenModal()}>+ Add Tax Rule</Button>
              <Button size="sm" variant="bordered" onPress={() => setSelectedRuleIds(new Set())}>Clear Selection</Button>
              <Button size="sm" variant="bordered" onPress={removeDuplicates} isDisabled={duplicatesCount === 0} title={duplicatesCount ? `${duplicatesCount} duplicates found` : 'No duplicates'}>
                Remove Duplicates{duplicatesCount ? ` (${duplicatesCount})` : ''}
              </Button>
              {selectedCountry === 'GH' && (
                <Button size="sm" variant="flat" onPress={restoreGhanaCoreRules}>
                  Restore Ghana Levies
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <Table aria-label="Tax rules table" selectionMode="multiple" selectedKeys={selectedRuleIds} onSelectionChange={(keys: any) => {
            if (keys === 'all') {
              const ids = taxRules
                .filter(rule => rule.countryCode === selectedCountry)
                .map(r => r.id);
              setSelectedRuleIds(new Set(ids));
            } else if (keys && typeof keys === 'object') {
              setSelectedRuleIds(new Set(Array.from(keys as any)));
            }
          }}>
            <TableHeader>
            <TableColumn>RULE NAME</TableColumn>
            <TableColumn>TYPE</TableColumn>
              <TableColumn>RATE</TableColumn>
              <TableColumn>PRIORITY</TableColumn>
              <TableColumn>GL CODE</TableColumn>
              <TableColumn>APPLIES TO</TableColumn>
              <TableColumn>BASE</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody>
              {taxRules
                .filter(rule => rule.countryCode === selectedCountry)
              .filter(rule => (selectedTypeId ? ((rule as any).typeId || '') === selectedTypeId : true))
                .filter(rule => (filterOperation === 'both' ? true : ((rule as any).operation || 'both') === filterOperation))
                .filter(rule => ((rule as any).domain || 'sales') === filterDomain)
                // Effect filter removed
                .filter(rule => {
                  if (!searchTerm?.trim()) return true;
                  const q = searchTerm.toLowerCase();
                  return rule.name.toLowerCase().includes(q) || (rule.glCode || '').toLowerCase().includes(q);
                })
                .filter((rule, idx, arr) => arr.findIndex(r => r.id === rule.id) === idx)
                .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
                .map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-gray-500">{rule.description || 'No description'}</p>
                      </div>
                    </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-600">{(taxTypes || []).find(t => t.id === (rule as any).typeId)?.name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Chip color="success" variant="flat">
                        {rule.rate}%
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip variant="flat">{rule.priority ?? 100}</Chip>
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
                      <span className="text-xs text-gray-600">{rule.calculationBase || 'subtotal'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="bordered"
                          onPress={() => reorderRule(rule.id, 'up')}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="bordered"
                          onPress={() => reorderRule(rule.id, 'down')}
                        >
                          ↓
                        </Button>
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
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold">Unified Tax Simulator</h3>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span>Country:</span>
              <span>{countries.find(c => c.code === selectedCountry)?.flag} {selectedCountry}</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input label="Amount" type="number" value={String(sim.amount)} onChange={(e) => setSim({ ...sim, amount: parseFloat(e.target.value || '0') })} variant="bordered" />
            <Input label="Category" value={sim.category} onChange={(e) => setSim({ ...sim, category: e.target.value })} variant="bordered" />
            <Select label="Domain" selectedKeys={[sim.domain]} onSelectionChange={(k) => setSim({ ...sim, domain: Array.from(k)[0] as any })} variant="bordered">
              <SelectItem key="sales">Sales</SelectItem>
              <SelectItem key="purchases">Purchases</SelectItem>
              <SelectItem key="payroll">Payroll</SelectItem>
              <SelectItem key="corporate">Corporate</SelectItem>
            </Select>
            <Select label="Operation" selectedKeys={[sim.operation]} onSelectionChange={(k) => setSim({ ...sim, operation: Array.from(k)[0] as any })} variant="bordered">
              <SelectItem key="external">Revenue Centre</SelectItem>
              <SelectItem key="internal">Cost Centre</SelectItem>
            </Select>
            <Input label="Persons" type="number" value={String(sim.numPersons)} onChange={(e) => setSim({ ...sim, numPersons: parseInt(e.target.value || '1', 10) })} variant="bordered" />
            <Input label="Nights" type="number" value={String(sim.numNights)} onChange={(e) => setSim({ ...sim, numNights: parseInt(e.target.value || '1', 10) })} variant="bordered" />
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-medium mb-2">Breakdown</h4>
              <div className="space-y-1 text-sm">
                {(() => {
                  const ctx: any = { numPersons: sim.numPersons, numNights: sim.numNights, roomType: sim.roomType, industry: sim.industry, domain: sim.domain, operation: sim.operation, typeId: selectedTypeId };
                  const res = calcTax(Number(sim.amount) || 0, sim.category, ctx);
                  return res.taxes.map((t: any, idx: number) => (
                    <div key={`${t.name}-${idx}`} className="flex justify-between">
                      <span>{t.name}</span>
                      <span className="font-mono">{t.amount.toFixed(2)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const ctx: any = { numPersons: sim.numPersons, numNights: sim.numNights, roomType: sim.roomType, industry: sim.industry, domain: sim.domain, operation: sim.operation, typeId: selectedTypeId };
                const res = calcTax(Number(sim.amount) || 0, sim.category, ctx);
                const tax = res.taxes.reduce((s: number, t: any) => s + t.amount, 0);
                return (
                  <>
                    <div className="flex justify-between"><span>Total</span><span className="font-mono font-semibold">{res.total.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Effective Rate</span><span className="font-mono">{((tax / (Number(sim.amount) || 1)) * 100).toFixed(1)}%</span></div>
                  </>
                );
              })()}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Create Tax Type Modal */}
      <Modal isOpen={isTypeOpen} onClose={() => { onCloseType(); setIsEditingType(false); setEditingTypeId(null); }}>
        <ModalContent>
          <ModalHeader>{isEditingType ? 'Edit Tax Type' : 'Create Tax Type'}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Country <span className="text-danger-600">*</span></label>
                  <Select selectedKeys={[selectedCountry]} isDisabled isRequired variant="bordered">
                    <SelectItem key={selectedCountry}>{selectedCountry}</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Domain <span className="text-danger-600">*</span></label>
                  <Select selectedKeys={[typeForm.domain]} onSelectionChange={(k) => setTypeForm(prev => ({ ...prev, domain: Array.from(k)[0] as any }))} isRequired variant="bordered">
                    <SelectItem key="sales">Sales</SelectItem>
                    <SelectItem key="purchases">Purchases</SelectItem>
                    <SelectItem key="payroll">Payroll</SelectItem>
                    <SelectItem key="corporate">Corporate</SelectItem>
                    <SelectItem key="custom">Custom</SelectItem>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Operation <span className="text-danger-600">*</span></label>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant={typeForm.operation === 'internal' ? 'solid' : 'flat'} onPress={() => setTypeForm(prev => ({ ...prev, operation: 'internal' }))}>Internal</Button>
                  <Button size="sm" variant={typeForm.operation === 'external' ? 'solid' : 'flat'} onPress={() => setTypeForm(prev => ({ ...prev, operation: 'external' }))}>External</Button>
                  <Button size="sm" variant={typeForm.operation === 'both' ? 'solid' : 'flat'} onPress={() => setTypeForm(prev => ({ ...prev, operation: 'both' }))}>Both</Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tax Type Name <span className="text-danger-600">*</span></label>
                <Input
                  placeholder="e.g., VAT (Standard Rate)"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, name: e.target.value }))}
                  isRequired
                  variant="bordered"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  placeholder="Short description of this tax type"
                  value={typeForm.description}
                  onChange={(e) => setTypeForm(prev => ({ ...prev, description: e.target.value }))}
                  variant="bordered"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onCloseType}>Cancel</Button>
            <Button className="bg-ghana-green text-white" onPress={handleSaveTaxType} isDisabled={!typeForm.name.trim()}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Assign Existing Rules to Tax Type Modal */}
      <Modal isOpen={isAssignOpen} onClose={onCloseAssign} size="2xl">
        <ModalContent>
          <ModalHeader>Assign Rules to {(taxTypes || []).find(t => String(t.id) === String(selectedTypeId))?.name || 'Tax Type'}</ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Input className="w-64" placeholder="Search rules (name / GL)" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} variant="bordered" />
                <Button size="sm" variant="flat" onPress={() => setAssignSelection(new Set(
                  taxRules.filter(r => r.countryCode === selectedCountry).map(r => String(r.id))
                ))}>Select All</Button>
                <Button size="sm" variant="flat" onPress={() => setAssignSelection(new Set())}>Clear</Button>
              </div>
              <div className="max-h-[420px] overflow-auto divide-y divide-default-200 rounded-medium border border-default-200">
                {taxRules
                  .filter(r => r.countryCode === selectedCountry)
                  .filter((r, idx, arr) => {
                    // De-duplicate in modal view by content key
                    const key = buildRuleKey(r);
                    return arr.findIndex(x => buildRuleKey(x) === key) === idx;
                  })
                  .filter(r => {
                    const q = assignSearch.trim().toLowerCase();
                    if (!q) return true;
                    return r.name.toLowerCase().includes(q) || (r.glCode || '').toLowerCase().includes(q);
                  })
                  .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
                  .map(r => {
                    const id = String(r.id);
                    const checked = assignSelection.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-2 px-3">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            setAssignSelection(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(id); else next.delete(id);
                              return next;
                            });
                          }} />
                          <div>
                            <div className="text-sm font-medium">{r.name}</div>
                            <div className="text-xs text-gray-500">GL {r.glCode} • {(r as any).domain || 'sales'} • {(r as any).operation || 'both'} • Priority {r.priority ?? 100}</div>
                          </div>
                        </div>
                        <Chip size="sm" variant="flat">{r.rate}%</Chip>
                      </div>
                    );
                  })}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onCloseAssign}>Cancel</Button>
            <Button className="bg-ghana-green text-white" onPress={saveAssignedRules} isDisabled={!selectedTypeId}>Apply Selection</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Tax Rule Form Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalContent>
          <ModalHeader>
            {isEditMode ? 'Edit Tax Rule' : 'Create New Tax Rule'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Status removed: Active moved next to Tax Type below */}

              {/* Tax Type Context (selection happens in cards above) */}
                <div>
                <label className="text-sm font-medium">Tax Type <span className="text-danger-600">*</span></label>
                <div className="mt-1 flex items-center justify-between gap-4">
                  {selectedTypeId ? (
                    <div className="flex items-center gap-2">
                      <Chip variant="flat">{(taxTypes || []).find(t => t.id === selectedTypeId)?.name || 'Selected Type'}</Chip>
                        </div>
                  ) : (
                    <div className="text-xs text-danger-600">Select a Tax Type from the list above to add rules under it.</div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Active</span>
                    <Switch
                      isSelected={formData.isActive}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Rule Name */}
              <div>
                <label className="text-sm font-medium">Rule Name <span className="text-danger-600">*</span></label>
                <Input
                  className="mt-1"
                  placeholder="e.g., VAT (Standard Rate)"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  isRequired
                />
              </div>

              {/* Rate and GL Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tax Rate (%) <span className="text-danger-600">*</span></label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="15.0"
                    value={formData.rate.toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                    isRequired
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">GL Code <span className="text-danger-600">*</span></label>
                  <Input
                    placeholder="2100"
                    value={formData.glCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, glCode: e.target.value }))}
                    isRequired
                    variant="bordered"
                  />
                </div>
              </div>

              {/* Applies To */}
              <div>
                <label className="text-sm font-medium">Applies To Categories</label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
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

              {/* Advanced Settings */}
              <Divider className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1"> 
                    <span>Calculation Order</span>
                    <Tooltip content="Rules run in ascending order (smaller number runs first). Earlier rules can change the base for later ones (e.g., levies before VAT; compound stacks on previous). Use gaps like 10, 20, 30.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help">i</span>
                    </Tooltip>
                  </label>
                  <Input
                    type="number"
                    value={(formData.priority ?? 100).toString()}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value || '100', 10) }))}
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Calculation Base</label>
                  <Select
                    selectedKeys={[formData.calculationBase || 'subtotal']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, calculationBase: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="subtotal">Subtotal</SelectItem>
                    <SelectItem key="subtotal_plus_applied">Subtotal + Applied Taxes</SelectItem>
                    <SelectItem key="per_person">Per Person</SelectItem>
                    <SelectItem key="per_night">Per Night</SelectItem>
                    <SelectItem key="per_person_night">Per Person x Night</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Method</label>
                  <Select
                    selectedKeys={[formData.method || 'rate']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, method: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="rate">Rate (%)</SelectItem>
                    <SelectItem key="fixed">Fixed Amount</SelectItem>
                    <SelectItem key="tiered">Tiered</SelectItem>
                  </Select>
                </div>
                {formData.method === 'fixed' && (
                  <div>
                    <label className="text-sm font-medium">Fixed Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(formData.fixedAmount ?? 0).toString()}
                      onChange={(e) => setFormData(prev => ({ ...prev, fixedAmount: parseFloat(e.target.value || '0') }))}
                      variant="bordered"
                    />
                  </div>
                )}
                {formData.method === 'tiered' && (
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium">Tiers</label>
                    <div className="text-xs text-gray-500 mt-1">Define progressive brackets. Each tier can use a percentage (Rate %) or a fixed amount; tiers are applied from top to bottom based on the base amount.</div>
                    <div className="space-y-2 mt-2">
                      {(formData.tiers || []).map((t, idx) => (
                        <div key={idx} className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Upto amount"
                            type="number"
                            value={t.upto?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, upto: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                          <Input
                            placeholder="Rate % (optional)"
                            type="number"
                            value={t.rate?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, rate: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                          <Input
                            placeholder="Fixed amount (optional)"
                            type="number"
                            value={t.fixed?.toString() || ''}
                            onChange={(e) => {
                              const v = e.target.value ? parseFloat(e.target.value) : undefined;
                              setFormData(prev => ({
                                ...prev,
                                tiers: prev.tiers?.map((x, i) => i === idx ? { ...x, fixed: v } : x) || []
                              }));
                            }}
                            variant="bordered"
                          />
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="bordered"
                        onPress={() => setFormData(prev => ({ ...prev, tiers: [...(prev.tiers || []), {}] }))}
                      >
                        + Add Tier
                      </Button>
                      <div className="text-xs text-gray-500">Example: Upto 1000 = 2% then remaining = 1% will charge 2% on the first 1000 and 1% on the rest.</div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Stacking</label>
                  <Select
                    selectedKeys={[formData.stacking || 'additive']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, stacking: selectedKey }));
                    }}
                    variant="bordered"
                  >
                    <SelectItem key="additive">Additive</SelectItem>
                    <SelectItem key="compound">Compound</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Rounding</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      selectedKeys={[formData.rounding || 'none']}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as any;
                        setFormData(prev => ({ ...prev, rounding: selectedKey }));
                      }}
                      variant="bordered"
                    >
                      <SelectItem key="none">None</SelectItem>
                      <SelectItem key="nearest">Nearest</SelectItem>
                      <SelectItem key="down">Down</SelectItem>
                      <SelectItem key="up">Up</SelectItem>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.01"
                      value={(formData.roundTo ?? 0.01).toString()}
                      onChange={(e) => setFormData(prev => ({ ...prev, roundTo: parseFloat(e.target.value || '0.01') }))}
                      variant="bordered"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">Domain
                    <Tooltip content="Business area where the rule applies (Sales/Revenue, Purchases/Procurement, Payroll, Corporate, or Custom). Centre (Cost vs Revenue) is chosen separately.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                    </Tooltip>
                  </label>
                  <Select
                    selectedKeys={[formData.domain || 'sales']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, domain: selectedKey }));
                    }}
                    isDisabled={Boolean(selectedTypeId || formData.typeId)}
                    variant="bordered"
                  >
                    <SelectItem key="sales">Sales</SelectItem>
                    <SelectItem key="purchases">Purchases</SelectItem>
                    <SelectItem key="payroll">Payroll</SelectItem>
                    <SelectItem key="corporate">Corporate</SelectItem>
                    <SelectItem key="custom">Custom</SelectItem>
                  </Select>
                  {Boolean(selectedTypeId || formData.typeId) && (
                    <div className="text-xs text-gray-500 mt-1">Inherited from selected tax type</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">Operation
                    <Tooltip content="Cost Centre (purchases, payroll, internal spend). Revenue Centre (sales, customer invoices, guest folios). Both applies in either context.">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-xs cursor-help ml-1">i</span>
                    </Tooltip>
                  </label>
                  <Select
                    selectedKeys={[formData.operation || 'both']}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as any;
                      setFormData(prev => ({ ...prev, operation: selectedKey }));
                    }}
                    isDisabled={Boolean(selectedTypeId || formData.typeId)}
                    variant="bordered"
                   >
                     <SelectItem key="internal">Cost Centre</SelectItem>
                     <SelectItem key="external">Revenue Centre</SelectItem>
                    <SelectItem key="both">Both</SelectItem>
                  </Select>
                  {Boolean(selectedTypeId || formData.typeId) && (
                    <div className="text-xs text-gray-500 mt-1">Inherited from selected tax type</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Effective From</label>
                  <Input
                    type="date"
                    value={formData.effectiveFrom || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                    variant="bordered"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Effective To</label>
                  <Input
                    type="date"
                    value={formData.effectiveTo || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, effectiveTo: e.target.value }))}
                    variant="bordered"
                  />
                </div>
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
              isDisabled={!formData.name || !formData.glCode || !formData.typeId}
            >
              {isEditMode ? 'Update Rule' : 'Create Rule'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
